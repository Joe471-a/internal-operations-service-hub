const bcrypt = require('bcrypt');

/**
 * Internal Operations Service Hub — the people who can log in.
 *
 * Same ids `actors.ts` and `fixtures.js` already use (emp-001, it-staff-001,
 * ...) - this is only where those identities are proven from now on, not a
 * new cast of characters. Plaintext passwords exist only here, at seed time;
 * `resetUsers` hashes each one before it is ever written to the database.
 *
 * These credentials are also documented in docs/ for anyone who needs to log
 * in and test the hub - not shown on the login page itself.
 */
const USERS = [
  {
    id: 'emp-001',
    username: 'dana',
    password: 'dana123',
    displayName: 'Dana Karam (Employee)',
    role: 'employee',
    department: null,
  },
  {
    id: 'it-staff-001',
    username: 'yara',
    password: 'yara123',
    displayName: 'Yara Fakhoury (IT Staff)',
    role: 'staff',
    department: 'IT',
  },
  {
    id: 'it-lead-001',
    username: 'karim',
    password: 'karim123',
    displayName: 'Karim Rahal (IT Lead)',
    role: 'lead',
    department: 'IT',
  },
  {
    id: 'hr-lead-001',
    username: 'sami',
    password: 'sami123',
    displayName: 'Sami Nassar (HR Lead)',
    role: 'lead',
    department: 'HR',
  },
  {
    id: 'finance-staff-001',
    username: 'tarek',
    password: 'tarek123',
    displayName: 'Tarek Sleiman (Finance Staff)',
    role: 'staff',
    department: 'FINANCE',
  },
  {
    id: 'finance-lead-001',
    username: 'layla',
    password: 'layla123',
    displayName: 'Layla Haddad (Finance Lead)',
    role: 'lead',
    department: 'FINANCE',
  },
];

const SALT_ROUNDS = 10;

/**
 * Puts the database back to exactly the six users above, passwords hashed.
 *
 * Deletes first, same as resetFixtures - a test or a re-seed starts from a
 * world it fully knows, never from whatever a previous run left behind.
 */
async function resetUsers(prisma) {
  await prisma.user.deleteMany();

  for (const user of USERS) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        passwordHash: await bcrypt.hash(user.password, SALT_ROUNDS),
        displayName: user.displayName,
        role: user.role,
        department: user.department,
      },
    });
  }
}

module.exports = { USERS, resetUsers };
