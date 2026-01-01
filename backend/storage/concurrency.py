"""
Hierarchical concurrency control for project file operations.

This module provides:
- File-level queues: serialize operations on specific files
- Project-level locks: global barrier for project-wide operations
- Different files can be processed in parallel
- Project operations block all file operations until complete

Architecture:
    Project Lock (GLOBAL Barrier)
        │
        ├──► Blocks: RESTORE(project), DELETE(project)
        │
        ▼
    File Queues (Per-File Serialization)
        │
        ├──► Serializes: PUT(media), PUT(captions/file), DELETE(file), RESTORE(file)
        │
        └──► Parallel: fileA, fileB, fileC operations
"""

import asyncio

from typing import Awaitable, Callable, Dict, Optional, Tuple, Any, TypeVar

T = TypeVar("T")

async def run_in_threadpool(func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """
    Run a blocking function in a separate thread.
    
    Args:
        func: The blocking function to run
        *args: Positional arguments for func
        **kwargs: Keyword arguments for func
        
    Returns:
        The result of func
    """
    loop = asyncio.get_running_loop()
    if kwargs:
        from functools import partial
        func = partial(func, **kwargs)
    return await loop.run_in_executor(None, func, *args)



# Queue key patterns
FILE_QUEUE_KEY = "{project_id}:{filename}"
PROJECT_LOCK_KEY = "{project_id}:GLOBAL"


class HierarchicalQueueManager:
    """
    Manages hierarchical queues for project file operations.

    Thread-safe implementation using asyncio.Lock and asyncio.Queue.
    """

    def __init__(self, queue_timeout: float = 30.0):
        """
        Initialize the queue manager.

        Args:
            queue_timeout: Maximum time to wait for queue operation (seconds)
        """
        self._file_queues: Dict[str, asyncio.Queue] = {}
        self._project_locks: Dict[str, asyncio.Lock] = {}
        self._queue_locks: Dict[str, asyncio.Lock] = {}  # For queue creation
        self._workers: Dict[str, asyncio.Task] = {}
        self._queue_timeout = queue_timeout

    def _get_file_queue_key(self, project_id: str, filename: str) -> str:
        """Generate queue key for file-level operations."""
        return f"{project_id}:{filename}"

    def _get_project_lock_key(self, project_id: str) -> str:
        """Generate lock key for project-level operations."""
        return f"{project_id}:GLOBAL"

    async def _get_or_create_queue(
        self,
        queue_key: str,
    ) -> asyncio.Queue:
        """
        Get or create a file queue lazily.

        Args:
            queue_key: Queue identifier

        Returns:
            The asyncio.Queue for this key
        """
        # Get or create queue access lock
        if queue_key not in self._queue_locks:
            self._queue_locks[queue_key] = asyncio.Lock()

        async with self._queue_locks[queue_key]:
            if queue_key not in self._file_queues:
                queue = asyncio.Queue()
                self._file_queues[queue_key] = queue

                # Start worker task
                worker = asyncio.create_task(self._worker(queue_key))
                self._workers[queue_key] = worker

            return self._file_queues[queue_key]

    async def _worker(self, queue_key: str) -> None:
        """
        Worker task that processes queue items sequentially.

        Args:
            queue_key: Queue identifier to process
        """
        while True:
            try:
                queue = self._file_queues.get(queue_key)
                if queue is None:
                    break

                # Wait for next item (with timeout for cleanup)
                try:
                    item = await asyncio.wait_for(
                        queue.get(),
                        timeout=300.0,  # 5 minutes idle timeout
                    )
                except asyncio.TimeoutError:
                    # Queue idle, cleanup
                    await self._cleanup_queue(queue_key)
                    break

                # Process item
                func, args, kwargs, future = item
                try:
                    result = await func(*args, **kwargs)
                    if not future.cancelled():
                        future.set_result(result)
                except Exception as e:
                    if not future.cancelled():
                        future.set_exception(e)
                finally:
                    queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception:
                # Log error but continue processing
                continue

    async def _cleanup_queue(self, queue_key: str) -> None:
        """
        Clean up an idle queue.

        Args:
            queue_key: Queue identifier to cleanup
        """
        # Cancel worker
        worker = self._workers.pop(queue_key, None)
        if worker and not worker.done():
            worker.cancel()

        # Remove queue
        self._file_queues.pop(queue_key, None)

    async def execute_file_operation(
        self,
        project_id: str,
        filename: str,
        operation: Callable[..., Awaitable[Any]],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Execute a file-level operation with queue serialization.

        Operations on the same file are serialized.
        Operations on different files run in parallel.

        Args:
            project_id: Project UUID
            filename: File name (for queue key)
            operation: Async function to execute
            *args: Positional args for operation
            **kwargs: Keyword args for operation

        Returns:
            Result of the operation

        Raises:
            asyncio.TimeoutError: If operation times out
            Exception: If operation fails
        """
        queue_key = self._get_file_queue_key(project_id, filename)
        queue = await self._get_or_create_queue(queue_key)

        # Create future for result
        future: asyncio.Future = asyncio.Future()

        # Add to queue
        await queue.put((operation, args, kwargs, future))

        # Wait for result with timeout
        try:
            return await asyncio.wait_for(
                future,
                timeout=self._queue_timeout,
            )
        except asyncio.TimeoutError:
            # Cancel future if timeout
            if not future.done():
                future.cancel()
            raise

    async def execute_project_operation(
        self,
        project_id: str,
        operation: Callable[..., Awaitable[Any]],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Execute a project-level operation with global barrier.

        Project-level operations block ALL file operations until complete.
        Existing file operations will complete before this starts.

        Args:
            project_id: Project UUID
            operation: Async function to execute
            *args: Positional args for operation
            **kwargs: Keyword args for operation

        Returns:
            Result of the operation

        Raises:
            asyncio.TimeoutError: If operation times out
            Exception: If operation fails
        """
        lock_key = self._get_project_lock_key(project_id)

        # Get or create project lock
        if lock_key not in self._project_locks:
            self._project_locks[lock_key] = asyncio.Lock()

        # Wait for lock (this waits for existing operations)
        async with self._project_locks[lock_key]:
            # Wait for all file queues to drain
            await self._wait_for_file_queues(project_id)

            # Execute operation
            try:
                return await asyncio.wait_for(
                    operation(*args, **kwargs),
                    timeout=self._queue_timeout,
                )
            except asyncio.TimeoutError:
                raise

    async def _wait_for_file_queues(self, project_id: str) -> None:
        """
        Wait for all file queues for a project to drain.

        Args:
            project_id: Project UUID
        """
        # Find all queues for this project
        queue_keys = [
            key for key in self._file_queues.keys()
            if key.startswith(f"{project_id}:")
        ]

        # Wait for each queue to empty
        for queue_key in queue_keys:
            queue = self._file_queues.get(queue_key)
            if queue:
                await queue.join()

    def shutdown(self) -> None:
        """
        Shutdown the queue manager.

        Cancel all worker tasks and clear queues.
        """
        for worker in self._workers.values():
            if not worker.done():
                worker.cancel()

        self._file_queues.clear()
        self._project_locks.clear()
        self._queue_locks.clear()
        self._workers.clear()


# Global singleton instance
_global_manager: Optional[HierarchicalQueueManager] = None


def get_queue_manager() -> HierarchicalQueueManager:
    """
    Get the global queue manager instance.

    Returns:
        The singleton HierarchicalQueueManager
    """
    global _global_manager
    if _global_manager is None:
        _global_manager = HierarchicalQueueManager()
    return _global_manager
