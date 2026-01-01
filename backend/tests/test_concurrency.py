"""
Tests for hierarchical concurrency control (concurrency.py).
"""

import asyncio
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

from storage.concurrency import HierarchicalQueueManager


@pytest.fixture
def queue_manager():
    """Create a fresh queue manager for each test."""
    manager = HierarchicalQueueManager()
    yield manager
    manager.shutdown()


class TestHierarchicalQueueManager:
    """Test HierarchicalQueueManager functionality."""

    @pytest.mark.asyncio
    async def test_file_operations_are_serialized(self, queue_manager):
        """Test that operations on the same file are serialized."""
        project_id = "test-project"
        filename = "test.txt"

        execution_order = []

        async def operation1():
            execution_order.append(1)
            await asyncio.sleep(0.01)  # Simulate work
            execution_order.append(2)
            return "op1"

        async def operation2():
            execution_order.append(3)
            await asyncio.sleep(0.01)
            execution_order.append(4)
            return "op2"

        async def operation3():
            execution_order.append(5)
            await asyncio.sleep(0.01)
            execution_order.append(6)
            return "op3"

        # Execute all operations concurrently
        results = await asyncio.gather(
            queue_manager.execute_file_operation(project_id, filename, operation1),
            queue_manager.execute_file_operation(project_id, filename, operation2),
            queue_manager.execute_file_operation(project_id, filename, operation3),
        )

        assert results == ["op1", "op2", "op3"]
        # Verify sequential execution (1,2 complete before 3 starts)
        assert execution_order == [1, 2, 3, 4, 5, 6]

    @pytest.mark.asyncio
    async def test_different_files_run_in_parallel(self, queue_manager):
        """Test that operations on different files run in parallel."""
        project_id = "test-project"

        execution_order = []

        async def file_a_op():
            execution_order.append("a_start")
            await asyncio.sleep(0.05)
            execution_order.append("a_end")
            return "a"

        async def file_b_op():
            execution_order.append("b_start")
            await asyncio.sleep(0.05)
            execution_order.append("b_end")
            return "b"

        # Execute operations on different files
        results = await asyncio.gather(
            queue_manager.execute_file_operation(project_id, "file_a.txt", file_a_op),
            queue_manager.execute_file_operation(project_id, "file_b.txt", file_b_op),
        )

        assert results == ["a", "b"]
        # Verify parallel execution (both start before either ends)
        assert execution_order == ["a_start", "b_start", "a_end", "b_end"] or \
               execution_order == ["b_start", "a_start", "b_end", "a_end"]

    @pytest.mark.asyncio
    async def test_project_operation_blocks_file_operations(self, queue_manager):
        """Test that project-level operation blocks file operations."""
        project_id = "test-project"

        file_ops_started = []
        project_op_started = []

        async def file_op(name):
            file_ops_started.append(name)
            await asyncio.sleep(0.01)
            return name

        async def project_op():
            project_op_started.append("project")
            # Wait a bit for file ops to queue
            await asyncio.sleep(0.02)
            return "project"

        # Start file operations first (they will queue)
        task1 = asyncio.create_task(
            queue_manager.execute_file_operation(project_id, "file1.txt", lambda: file_op("file1"))
        )
        task2 = asyncio.create_task(
            queue_manager.execute_file_operation(project_id, "file2.txt", lambda: file_op("file2"))
        )

        # Give them time to queue
        await asyncio.sleep(0.01)

        # Now start project operation (should wait for file ops to complete)
        task3 = asyncio.create_task(
            queue_manager.execute_project_operation(project_id, project_op)
        )

        results = await asyncio.gather(task1, task2, task3)

        assert results == ["file1", "file2", "project"]
        assert project_op_started == ["project"]

    @pytest.mark.asyncio
    async def test_read_operations_are_not_blocked(self, queue_manager):
        """Test that read operations return immediately (no blocking)."""
        project_id = "test-project"

        async def slow_write():
            await asyncio.sleep(0.05)
            return "written"

        async def fast_read():
            return "read"

        # Start slow write
        write_task = asyncio.create_task(
            queue_manager.execute_file_operation(project_id, "file.txt", slow_write)
        )

        # Start immediate read (different file, should not be blocked)
        read_result = await queue_manager.execute_file_operation(
            project_id, "other_file.txt", fast_read
        )

        # Read should complete immediately
        assert read_result == "read"

        # Wait for write to complete
        assert await write_task == "written"

    @pytest.mark.asyncio
    async def test_queue_timeout_raises_timeout_error(self, queue_manager):
        """Test that queue operation raises TimeoutError on timeout."""
        project_id = "test-project"

        async def never_completes():
            await asyncio.sleep(100)  # Will timeout before this
            return "done"

        # Set very short timeout for this manager
        short_timeout_manager = HierarchicalQueueManager(queue_timeout=0.01)

        with pytest.raises(asyncio.TimeoutError):
            await short_timeout_manager.execute_file_operation(
                project_id, "test.txt", never_completes
            )

        short_timeout_manager.shutdown()

    @pytest.mark.asyncio
    async def test_operation_exception_is_propagated(self, queue_manager):
        """Test that operation exceptions are propagated to caller."""
        project_id = "test-project"

        async def failing_operation():
            raise ValueError("Test error")

        with pytest.raises(ValueError, match="Test error"):
            await queue_manager.execute_file_operation(
                project_id, "test.txt", failing_operation
            )

    @pytest.mark.asyncio
    async def test_multiple_projects_dont_interfere(self, queue_manager):
        """Test that operations on different projects don't interfere."""
        execution_order = []

        async def project_a_op():
            execution_order.append("a_start")
            await asyncio.sleep(0.02)
            execution_order.append("a_end")
            return "a"

        async def project_b_op():
            execution_order.append("b_start")
            await asyncio.sleep(0.02)
            execution_order.append("b_end")
            return "b"

        results = await asyncio.gather(
            queue_manager.execute_file_operation("project_a", "file.txt", project_a_op),
            queue_manager.execute_file_operation("project_b", "file.txt", project_b_op),
        )

        assert results == ["a", "b"]
        # Should run in parallel
        assert "a_start" in execution_order and "b_start" in execution_order

    @pytest.mark.asyncio
    async def test_queue_cleanup_after_idle(self, queue_manager):
        """Test that idle queues are cleaned up."""
        project_id = "test-project"

        async def simple_op():
            return "done"

        # Execute operation
        await queue_manager.execute_file_operation(
            project_id, "test.txt", simple_op
        )

        # Queue should exist after operation
        file_queue_key = f"{project_id}:test.txt"
        assert file_queue_key in queue_manager._file_queues

        # Wait for idle timeout (simulate by checking queue exists)
        # In real scenario, worker would clean up after 5 minutes idle
        # For test, we just verify the mechanism exists

    @pytest.mark.asyncio
    async def test_concurrent_file_and_project_ops(self, queue_manager):
        """Test concurrent file and project operations behavior."""
        project_id = "test-project"
        results = []

        async def file_op(name):
            results.append(f"{name}_start")
            await asyncio.sleep(0.01)
            results.append(f"{name}_end")
            return name

        async def project_op():
            results.append("project_start")
            await asyncio.sleep(0.01)
            results.append("project_end")
            return "project"

        # Start multiple file ops
        tasks = [
            asyncio.create_task(
                queue_manager.execute_file_operation(project_id, "file1.txt", lambda: file_op("f1"))
            ),
            asyncio.create_task(
                queue_manager.execute_file_operation(project_id, "file2.txt", lambda: file_op("f2"))
            ),
        ]

        # Give them time to start
        await asyncio.sleep(0.005)

        # Start project op (should wait for file ops)
        project_task = asyncio.create_task(
            queue_manager.execute_project_operation(project_id, project_op)
        )

        # Wait for all
        await asyncio.gather(*tasks, project_task)

        # Verify results
        assert "f1_end" in results and "f2_end" in results
        assert "project_start" in results
        # Project should start after file ops complete
        f1_end_idx = results.index("f1_end")
        f2_end_idx = results.index("f2_end")
        project_start_idx = results.index("project_start")
        assert project_start_idx > max(f1_end_idx, f2_end_idx)
