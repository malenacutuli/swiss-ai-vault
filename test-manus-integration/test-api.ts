/**
 * Manus.im API Integration Test
 *
 * Tests the API connection and basic task creation before integrating into production.
 *
 * API Reference: https://open.manus.im/docs
 * Base URL: https://api.manus.ai/v1
 * Auth: API_KEY header
 */

const MANUS_API_KEY = process.env.MANUS_API_KEY || 'sk-ztmUl0AXfmniPw4eOuBc7YwbcSMzsHoA15a_z89JO2lnYhzcKBedizSO8pzgbyr1FOuBJct3JYHhEXfC24eSBh5ziruT';
const MANUS_API_BASE = 'https://api.manus.ai/v1';

interface ManusTaskResponse {
  task_id?: string;
  id?: string;
  status?: string;
  streaming_url?: string;
  created_at?: string;
  error?: string;
  message?: string;
}

interface ManusTaskStatus {
  task_id?: string;
  id?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  result?: {
    summary?: string;
    artifacts?: Array<{
      type: string;
      url: string;
      name: string;
    }>;
  };
  output?: any;
  credits_used?: number;
  error?: string;
}

async function testApiConnection(): Promise<boolean> {
  console.log('🔍 Testing API connection (listing tasks)...');

  try {
    const response = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'API_KEY': MANUS_API_KEY,
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API connection successful');
      const preview = JSON.stringify(data, null, 2);
      console.log(`   Response preview:`, preview.slice(0, 800));
      if (preview.length > 800) console.log('   ... (truncated)');
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ API returned error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error}`);
    return false;
  }
}

async function testCreateTask(): Promise<ManusTaskResponse | null> {
  console.log('\n🚀 Testing task creation...');

  try {
    const response = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'API_KEY': MANUS_API_KEY,
      },
      body: JSON.stringify({
        prompt: 'Say hello and confirm this API test is working. Keep response very brief (1-2 sentences max).',
      }),
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log(`   Response:`, JSON.stringify(data, null, 2));

    const taskId = data.task_id || data.id;
    if (response.ok && taskId) {
      console.log(`   ✅ Task created: ${taskId}`);
      return { ...data, task_id: taskId };
    } else {
      console.log(`   ❌ Task creation failed`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error}`);
    return null;
  }
}

async function testGetTaskStatus(taskId: string): Promise<ManusTaskStatus | null> {
  console.log(`\n📊 Getting task status for ${taskId}...`);

  try {
    const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'API_KEY': MANUS_API_KEY,
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    const preview = JSON.stringify(data, null, 2);
    console.log(`   Response:`, preview.slice(0, 1000));
    if (preview.length > 1000) console.log('   ... (truncated)');

    if (response.ok) {
      console.log(`   ✅ Task status: ${data.status}`);
      return data;
    } else {
      console.log(`   ❌ Failed to get status`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error}`);
    return null;
  }
}

async function pollUntilComplete(taskId: string, maxAttempts = 60): Promise<ManusTaskStatus | null> {
  console.log(`\n⏳ Polling task ${taskId} until completion (max ${maxAttempts} attempts, 3s interval)...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'API_KEY': MANUS_API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`   Attempt ${i + 1}: HTTP ${response.status}`);
        await sleep(3000);
        continue;
      }

      const status: ManusTaskStatus = await response.json();
      const currentStatus = status.status?.toLowerCase();

      if (currentStatus === 'completed' || currentStatus === 'done' || currentStatus === 'success') {
        console.log(`\n✅ Task completed!`);
        console.log(`   Full response:`, JSON.stringify(status, null, 2).slice(0, 2000));
        return status;
      }

      if (currentStatus === 'failed' || currentStatus === 'error') {
        console.log(`\n❌ Task failed: ${status.error || 'Unknown error'}`);
        return status;
      }

      if (currentStatus === 'cancelled') {
        console.log(`\n⚠️ Task was cancelled`);
        return status;
      }

      console.log(`   Attempt ${i + 1}: Status = ${status.status}`);
      await sleep(3000);
    } catch (error) {
      console.log(`   Attempt ${i + 1}: Error - ${error}`);
      await sleep(3000);
    }
  }

  console.log(`\n⚠️ Max attempts reached, task may still be running`);
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllTests() {
  console.log('═'.repeat(60));
  console.log('  MANUS API INTEGRATION TEST');
  console.log('═'.repeat(60));
  console.log(`  API Base: ${MANUS_API_BASE}`);
  console.log(`  API Key: ${MANUS_API_KEY.slice(0, 10)}...${MANUS_API_KEY.slice(-4)}`);
  console.log(`  Auth Header: API_KEY`);
  console.log('═'.repeat(60));

  // Test 1: API Connection
  const connected = await testApiConnection();
  if (!connected) {
    console.log('\n❌ API connection failed. Checking if we can still create tasks...');
  }

  // Test 2: Create Task
  const task = await testCreateTask();
  if (!task || !task.task_id) {
    console.log('\n❌ Task creation failed. Cannot proceed with further tests.');
    return;
  }

  // Test 3: Poll until complete
  const finalStatus = await pollUntilComplete(task.task_id);

  console.log('\n' + '═'.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  API Connection: ${connected ? '✅' : '⚠️ (but task creation worked)'}`);
  console.log(`  Task Creation: ✅`);
  console.log(`  Task ID: ${task.task_id}`);
  console.log(`  Final Status: ${finalStatus?.status || 'unknown'}`);
  console.log('═'.repeat(60));

  if (finalStatus?.status === 'completed' || finalStatus?.status === 'done') {
    console.log('\n🎉 SUCCESS! Manus API integration is working correctly.');
    console.log('   Ready to proceed with production integration.');
  } else {
    console.log('\n⚠️ Task did not complete successfully. Check the output above.');
  }
}

// Run tests
runAllTests().catch(console.error);
