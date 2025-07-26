import { updateAllStudentsQuizStats } from './lib/user-management';

// Script to update all students' quiz stats
async function main() {
  console.log('Starting to update all students quiz stats...');
  
  try {
    await updateAllStudentsQuizStats();
    console.log('✅ Successfully updated all students quiz stats!');
  } catch (error) {
    console.error('❌ Error updating students quiz stats:', error);
  }
}

// Run the script
main(); 