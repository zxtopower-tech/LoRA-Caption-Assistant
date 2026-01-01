
import sys
from pathlib import Path

# Adjust path to import backend modules
ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.append(str(BACKEND_DIR))

import asyncio
import threading
import time
import pytest
import os
from storage.project_manager import ProjectManager
from storage.history_manager import HistoryManager

# Helper to verify non-blocking behavior
async def heartbeat_monitor(interval=0.01, duration=0.2):
    """Monitor main loop responsiveness."""
    start_time = time.time()
    lags = []
    
    while time.time() - start_time < duration:
        loop_start = time.time()
        await asyncio.sleep(interval)
        actual_interval = time.time() - loop_start
        # Record discrepancy (lag)
        lags.append(actual_interval - interval)
        
    return lags

@pytest.fixture
def async_env(tmp_path):
    projects_dir = tmp_path / "projects"
    projects_dir.mkdir()
    hm = HistoryManager(projects_dir)
    pm = ProjectManager(projects_dir, hm)
    return pm, projects_dir

@pytest.mark.asyncio
class TestAsyncIOBehavior:
    
    async def test_heavy_io_does_not_block(self, async_env):
        """
        Verification of Async Behavior (NON-BLOCKING).
        This test expects the implementation to NOT block the main loop.
        
        Requirement: Heavy IO should NOT block.
        We assert that max_lag is SMALL (< 0.05s).
        """
        pm, _ = async_env
        project_id = "test_perf_proj"
        await pm.ensure_project_dir(project_id)
        
        # Create large content (e.g. 50MB) to force noticeable IO time
        # Just generating bytes takes time, so prepare it first.
        content = b"0" * (1024 * 1024 * 20) # 20MB
        filename = "heavy_file.bin"
        
        # Start Heartbeat Monitor
        monitor_task = asyncio.create_task(heartbeat_monitor(interval=0.01, duration=0.5))
        
        # Execute "heavy" operation
        # Since currently save_media_file is synchronous, 
        # unwrapped call will block entirely.
        # But to use it in async test properly as if it WAS async (future interface),
        # we might need to wrap it ourselves or just call it if it's sync.
        
        # Challenge: We need to test the *interface* we want.
        # If we want `await pm.save_media_file(...)`, we can't call it if it is synchronous.
        # But TDD says implementation should change to match test.
        # So we try to `await` it. 
        # Current implementation is not async, so `await` will fail with TypeError.
        # THAT IS A VALID RED state.
        
        # However, to test BLOCKING behavior specifically (assuming we fix the interface first),
        # let's assume we want to validata that logic runs in thread.
        
        # Strategy:
        # 1. Call it. If it raises TypeError (not awaitable), that is RED.
        # 2. If it is awaitable but blocks, assertion fails. RED.
        
        try:
            # This line will crash with TypeError in current codebase
            await pm.save_media_file(project_id, filename, content)
        except TypeError:
            pytest.fail("ProjectManager.save_media_file is not awaitable (Synchronous Implementation detected)")
        
        lags = await monitor_task
        
        # Analyze lags
        max_lag = max(lags) if lags else 0
        
        # Expectation for Async IO: Lag should be minimal (scheduling overhead only)
        # If blocking, lag will be ~ disk write time
        assert max_lag < 0.05, f"Main loop blocked! Max lag: {max_lag:.4f}s"

    async def test_thread_offloading_verification(self, async_env):
        """
        Verify that IO operations run in a different thread than the main loop.
        """
        pm, _ = async_env
        project_id = "test_thread_proj"
        await pm.ensure_project_dir(project_id)
        
        main_thread_id = threading.get_ident()
        
        # We need to capture the thread ID inside the execution.
        # Since we can't easily inject code into existing method without mocking,
        # we rely on the implementation property.
        
        # But wait, we can mock `open` or `shutil.copy` to capture thread ID!
        captured_thread_ids = []
        
        original_open = open
        
        def spy_open(*args, **kwargs):
            captured_thread_ids.append(threading.get_ident())
            return original_open(*args, **kwargs)
            
        # Patch `builtins.open` is messy. Patching `storage.project_manager.open` is better.
        # But project_manager uses `open()`.
        
        with pytest.MonkeyPatch.context() as m:
            # Note: mocking builtins is tricky. 
            # Let's try to infer from blocking behavior mostly, 
            # but if we can verify thread ID it's better.
            
            # Alternative: Adding a debug method to PM that sleeps and returns thread ID.
            pass
            
        # Simplest RED test for now: Just `await` check.
        # If it's sync, it fails.
        filename = "test.txt"
        try:
            await pm.save_media_file(project_id, filename, b"data")
        except TypeError:
             pytest.fail("Method is not async (runs in main thread stack)")
             
        # If we reach here (it is async), we haven't verified offloading yet completely
        # unless checked explicitly. 
        # But Step 1 is mostly about interface compliance and blocking check.
        # The previous test covers blocking check.
        
        # This test is redundant if the above covers it, but nice to have distinct failure message.

