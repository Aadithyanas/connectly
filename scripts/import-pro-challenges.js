const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const challenges = [
  {
    title: "Two Sum",
    difficulty: "easy",
    category: "dsa",
    points: 10,
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to target.",
    test_cases: [
      { input: "[2,7,11,15], 9", output: "[0,1]" },
      { input: "[3,2,4], 6", output: "[1,2]" },
      { input: "[3,3], 6", output: "[0,1]" },
      { input: "[1,5,8], 9", output: "[0,2]" },
      { input: "[0,4,3,0], 0", output: "[0,3]" }
    ]
  },
  {
    title: "Palindrome Check",
    difficulty: "easy",
    category: "logic",
    points: 10,
    description: "Given a string `s`, return true if it is a palindrome, or false otherwise.",
    test_cases: [
      { input: "racecar", output: "true" },
      { input: "hello", output: "false" },
      { input: "madam", output: "true" },
      { input: "Step on no pets", output: "true" },
      { input: "12321", output: "true" }
    ]
  },
  {
    title: "FizzBuzz",
    difficulty: "easy",
    category: "logic",
    points: 5,
    description: "Return 'Fizz' if number is divisible by 3, 'Buzz' if by 5, and 'FizzBuzz' if by both.",
    test_cases: [
      { input: "3", output: "Fizz" },
      { input: "5", output: "Buzz" },
      { input: "15", output: "FizzBuzz" },
      { input: "7", output: "7" },
      { input: "30", output: "FizzBuzz" }
    ]
  },
  {
    title: "Reverse String",
    difficulty: "easy",
    category: "strings",
    points: 10,
    description: "Write a function that reverses a string.",
    test_cases: [
      { input: "hello", output: "olleh" },
      { input: "world", output: "dlrow" },
      { input: "Connectly", output: "yltcennoC" },
      { input: "12345", output: "54321" },
      { input: "a", output: "a" }
    ]
  },
  {
    title: "Find Max",
    difficulty: "easy",
    category: "dsa",
    points: 10,
    description: "Find the largest number in an array.",
    test_cases: [
      { input: "[1,5,3,9,2]", output: "9" },
      { input: "[-1,-5,-2]", output: "-1" },
      { input: "[10,10,10]", output: "10" },
      { input: "[0]", output: "0" },
      { input: "[1,2,3,4,5,100]", output: "100" }
    ]
  },
  {
    title: "Anagram Check",
    difficulty: "medium",
    category: "strings",
    points: 20,
    description: "Determine if two strings are anagrams of each other.",
    test_cases: [
      { input: "listen, silent", output: "true" },
      { input: "hello, world", output: "false" },
      { input: "rat, car", output: "false" },
      { input: "anagram, nagaram", output: "true" },
      { input: "a, a", output: "true" }
    ]
  },
  {
    title: "Fibonacci",
    difficulty: "medium",
    category: "dsa",
    points: 20,
    description: "Return the N-th number in the Fibonacci sequence.",
    test_cases: [
      { input: "0", output: "0" },
      { input: "1", output: "1" },
      { input: "5", output: "5" },
      { input: "10", output: "55" },
      { input: "20", output: "6765" }
    ]
  },
  {
    title: "Contains Duplicate",
    difficulty: "easy",
    category: "dsa",
    points: 15,
    description: "Return true if any value appears at least twice in the array.",
    test_cases: [
      { input: "[1,2,3,1]", output: "true" },
      { input: "[1,2,3,4]", output: "false" },
      { input: "[1,1,1,3,3,4,3,2,4,2]", output: "true" },
      { input: "[]", output: "false" },
      { input: "[1]", output: "false" }
    ]
  },
  {
    title: "Missing Number",
    difficulty: "medium",
    category: "dsa",
    points: 25,
    description: "Find the missing number in an array containing n distinct numbers from 0 to n.",
    test_cases: [
      { input: "[3,0,1]", output: "2" },
      { input: "[0,1]", output: "2" },
      { input: "[9,6,4,2,3,5,7,0,1]", output: "8" },
      { input: "[0]", output: "1" },
      { input: "[1]", output: "0" }
    ]
  },
  {
    title: "Power of Three",
    difficulty: "easy",
    category: "math",
    points: 10,
    description: "Return true if the integer is a power of three.",
    test_cases: [
      { input: "27", output: "true" },
      { input: "0", output: "false" },
      { input: "9", output: "true" },
      { input: "45", output: "false" },
      { input: "1", output: "true" }
    ]
  }
];

async function importData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'connectly');
    const collection = db.collection('challenges');

    console.log('--- Starting Pro Import ---');
    
    // Optional: Clear existing data
    await collection.deleteMany({});
    console.log('Cleared existing challenges.');

    const result = await collection.insertMany(challenges.map(c => ({
      ...c,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date()
    })));

    console.log(`✅ Success! Imported ${result.insertedCount} Pro Challenges into MongoDB.`);
  } catch (err) {
    console.error('Import Failed:', err);
  } finally {
    await client.close();
  }
}

importData();
