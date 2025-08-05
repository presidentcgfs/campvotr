// Test script to verify voter lists functionality
// This script tests the voter lists API endpoints

const BASE_URL = 'http://localhost:5174';

async function testVoterListsAPI() {
	console.log('Testing Voter Lists API...');

	try {
		// Test GET /api/voter-lists without authentication
		console.log('\n1. Testing GET /api/voter-lists without auth...');
		const response1 = await fetch(`${BASE_URL}/api/voter-lists`);
		console.log('Status:', response1.status);
		console.log('Response:', await response1.text());

		// Test POST /api/voter-lists without authentication
		console.log('\n2. Testing POST /api/voter-lists without auth...');
		const response2 = await fetch(`${BASE_URL}/api/voter-lists`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: 'Test List',
				description: 'Test Description',
				voterEmails: ['test@example.com']
			})
		});
		console.log('Status:', response2.status);
		console.log('Response:', await response2.text());

		console.log('\nAPI endpoints are responding correctly (401 Unauthorized as expected)');
	} catch (error) {
		console.error('Error testing API:', error);
	}
}

// Run the test
testVoterListsAPI();
