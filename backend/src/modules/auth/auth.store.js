import { randomUUID } from 'node:crypto';
import { fetchAll, fetchOne, query } from '../../db/mysql.js';
import { AppError, isDatabaseUnavailableError } from '../../lib/errors.js';
import {
  activateAdminLocal,
  createAdminLocal,
  createFarmerLocal,
  deleteUserByAdminLocal,
  findFarmerByPhoneLocal,
  getUserByIdLocal,
  getUserRecordByIdLocal,
  listUsersLocal,
  touchLastLoginLocal,
  updateAdminProfileLocal,
  updateUserByAdminLocal,
  verifyAdminCredentialsLocal,
} from '../../lib/local-store.js';
import { hashPassword, verifyPassword } from '../../lib/passwords.js';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    status: row.status,
    adminEnabled: row.role === 'admin' && row.status === 'active',
    location: '',
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

async function withLocalFallback(action, fallback) {
  try {
    return await action();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fallback();
    }
    throw error;
  }
}

export async function getUserById(userId) {
  return withLocalFallback(
    async () => {
      const row = await fetchOne('SELECT * FROM users WHERE id = ?', [userId]);
      return sanitizeUser(row);
    },
    () => getUserByIdLocal(userId),
  );
}

export async function getUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  return withLocalFallback(
    async () => {
      const row = await fetchOne('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
      return sanitizeUser(row);
    },
    () => listUsersLocal().find((entry) => normalizeEmail(entry.email) === normalizedEmail) || null,
  );
}

export async function getUserRecordById(userId) {
  return withLocalFallback(
    () => fetchOne('SELECT * FROM users WHERE id = ?', [userId]),
    () => getUserRecordByIdLocal(userId),
  );
}

export async function findFarmerByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new AppError(400, 'Phone number is required.');
  }

  return withLocalFallback(
    async () => {
      const row = await fetchOne('SELECT * FROM users WHERE role = ? AND phone = ?', ['farmer', normalizedPhone]);
      if (!row) {
        throw new AppError(404, 'User not registered');
      }

      if (row.status !== 'active') {
        throw new AppError(403, 'This farmer account is disabled.');
      }

      return sanitizeUser(row);
    },
    () => findFarmerByPhoneLocal(normalizedPhone),
  );
}

export async function createFarmer(payload) {
  const name = String(payload.name || '').trim();
  const phone = normalizePhone(payload.phone);

  if (!name) {
    throw new AppError(400, 'Name is required.');
  }
  if (!phone) {
    throw new AppError(400, 'Phone number is required.');
  }

  return withLocalFallback(
    async () => {
      const existing = await fetchOne('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existing) {
        throw new AppError(409, 'User already exists, please login');
      }

      const id = randomUUID();
      await query(
        `
          INSERT INTO users (id, role, name, phone, status)
          VALUES (?, 'farmer', ?, ?, 'active')
        `,
        [id, name, phone],
      );

      return getUserById(id);
    },
    () => createFarmerLocal({ name, phone }),
  );
}

export async function createAdmin(payload) {
  return createAdminRecord(payload, 'pending');
}

function buildOwnerPassword() {
  const base = randomUUID().replace(/-/g, '');
  return `${base}Aa1!`;
}

async function createAdminRecord(payload, status = 'pending') {
  const name = String(payload.name || '').trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');

  if (!name) {
    throw new AppError(400, 'Name is required.');
  }
  if (!email) {
    throw new AppError(400, 'Email is required.');
  }
  if (password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters long.');
  }

  return withLocalFallback(
    async () => {
      const existing = await fetchOne('SELECT * FROM users WHERE email = ?', [email]);
      if (existing) {
        if (existing.role === 'admin' && existing.status === 'pending') {
          const { salt, hash } = hashPassword(password);
          await query(
            `
              UPDATE users
              SET name = ?, password_hash = ?, updated_at = NOW()
              WHERE id = ?
            `,
            [name, `${salt}:${hash}`, existing.id],
          );

          return getUserById(existing.id);
        }

        throw new AppError(409, 'Admin email already exists.');
      }

      const { salt, hash } = hashPassword(password);
      const id = randomUUID();
      await query(
        `
          INSERT INTO users (id, role, name, email, password_hash, status)
          VALUES (?, 'admin', ?, ?, ?, ?)
        `,
        [id, name, email, `${salt}:${hash}`, status],
      );

      return getUserById(id);
    },
    () => createAdminLocal({ name, email, password }, status),
  );
}

function readStoredPassword(passwordHash) {
  const [salt = '', hash = ''] = String(passwordHash || '').split(':');
  return { salt, hash };
}

export async function verifyAdminCredentials(email, password, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  const allowPending = Boolean(options.allowPending);
  return withLocalFallback(
    async () => {
      const user = await fetchOne('SELECT * FROM users WHERE role = ? AND email = ?', ['admin', normalizedEmail]);

      if (!user) {
        throw new AppError(404, 'Admin not registered');
      }

      const { salt, hash } = readStoredPassword(user.password_hash);
      if (!salt || !hash || !verifyPassword(password, salt, hash)) {
        throw new AppError(401, 'Invalid email or password.');
      }

      if (user.status === 'pending' && !allowPending) {
        throw new AppError(403, 'Admin signup pending verification. Please complete signup OTP.');
      }

      if (user.status === 'disabled') {
        throw new AppError(403, 'This admin account is disabled.');
      }

      return sanitizeUser(user);
    },
    () => verifyAdminCredentialsLocal(normalizedEmail, password, { allowPending }),
  );
}

export async function activateAdmin(userId) {
  return withLocalFallback(
    async () => {
      await query("UPDATE users SET status = 'active' WHERE id = ?", [userId]);
      return getUserById(userId);
    },
    () => activateAdminLocal(userId),
  );
}

export async function touchLastLogin(userId) {
  return withLocalFallback(
    async () => {
      await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
      return getUserById(userId);
    },
    () => touchLastLoginLocal(userId),
  );
}

export async function updateAdminProfile(userId, patch) {
  return withLocalFallback(
    async () => {
      const current = await fetchOne('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'admin']);
      if (!current) {
        throw new AppError(404, 'Admin not found.');
      }

      const nextName = patch.name ? String(patch.name).trim() : current.name;
      const nextEmail = patch.email ? normalizeEmail(patch.email) : current.email;
      let nextPasswordHash = current.password_hash;

      if (patch.email && nextEmail !== current.email) {
        const existing = await fetchOne('SELECT id FROM users WHERE email = ? AND id <> ?', [nextEmail, userId]);
        if (existing) {
          throw new AppError(409, 'Admin email already exists.');
        }
      }

      if (patch.password) {
        if (String(patch.password).length < 8) {
          throw new AppError(400, 'Password must be at least 8 characters long.');
        }
        const { salt, hash } = hashPassword(String(patch.password));
        nextPasswordHash = `${salt}:${hash}`;
      }

      await query(
        `
          UPDATE users
          SET name = ?, email = ?, password_hash = ?
          WHERE id = ?
        `,
        [nextName, nextEmail, nextPasswordHash, userId],
      );

      return getUserById(userId);
    },
    () => updateAdminProfileLocal(userId, patch),
  );
}

export async function listUsers() {
  return withLocalFallback(
    async () => {
      const rows = await fetchAll(
        `
          SELECT *
          FROM users
          ORDER BY created_at DESC
        `,
      );
      return rows.map(sanitizeUser);
    },
    () => listUsersLocal(),
  );
}

export async function createManagedUser(payload) {
  const role = String(payload.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'farmer') {
    throw new AppError(400, 'Role must be admin or farmer.');
  }

  if (role === 'farmer') {
    return createFarmer(payload);
  }

  return createAdminRecord(payload, 'active');
}

export async function ensureOwnerAdmin(payload) {
  const name = String(payload.name || '').trim() || 'Owner';
  const email = normalizeEmail(payload.email);

  if (!email) {
    throw new AppError(400, 'Owner email is required.');
  }

  return withLocalFallback(
    async () => {
      const existing = await fetchOne('SELECT * FROM users WHERE email = ?', [email]);
      if (existing) {
        let nextPasswordHash = existing.password_hash;
        if (!nextPasswordHash) {
          const { salt, hash } = hashPassword(buildOwnerPassword());
          nextPasswordHash = `${salt}:${hash}`;
        }

        await query(
          `
            UPDATE users
            SET role = 'admin',
                name = ?,
                phone = NULL,
                password_hash = ?,
                status = 'active',
                updated_at = NOW()
            WHERE id = ?
          `,
          [name, nextPasswordHash, existing.id],
        );
        return getUserById(existing.id);
      }

      return createAdminRecord(
        {
          name,
          email,
          password: buildOwnerPassword(),
        },
        'active',
      );
    },
    () => {
      const existing = listUsersLocal().find((entry) => normalizeEmail(entry.email) === email);
      if (!existing) {
        return createAdminLocal(
          {
            name,
            email,
            password: buildOwnerPassword(),
          },
          'active',
        );
      }

      return updateUserByAdminLocal(existing.id, {
        role: 'admin',
        name,
        email,
        password: buildOwnerPassword(),
        status: 'active',
      });
    },
  );
}

export async function updateUserByAdmin(userId, patch) {
  return withLocalFallback(
    async () => {
      const current = await fetchOne('SELECT * FROM users WHERE id = ?', [userId]);
      if (!current) {
        throw new AppError(404, 'User not found.');
      }

      const nextRole = patch.role ? String(patch.role).toLowerCase() : current.role;
      if (nextRole !== 'admin' && nextRole !== 'farmer') {
        throw new AppError(400, 'Role must be admin or farmer.');
      }

      const nextName = patch.name ? String(patch.name).trim() : current.name;
      if (!nextName) {
        throw new AppError(400, 'Name is required.');
      }

      const nextStatus = patch.status ? String(patch.status).toLowerCase() : current.status;
      if (!['active', 'disabled', 'pending'].includes(nextStatus)) {
        throw new AppError(400, 'Invalid status value.');
      }

      let nextPhone = current.phone;
      let nextEmail = current.email;
      let nextPasswordHash = current.password_hash;

      if (nextRole === 'farmer') {
        nextPhone = patch.phone ? normalizePhone(patch.phone) : normalizePhone(current.phone);
        if (!nextPhone) {
          throw new AppError(400, 'Phone number is required for farmers.');
        }

        const phoneOwner = await fetchOne('SELECT id FROM users WHERE phone = ? AND id <> ?', [nextPhone, userId]);
        if (phoneOwner) {
          throw new AppError(409, 'Phone number is already in use.');
        }

        nextEmail = null;
        nextPasswordHash = null;
      } else {
        nextEmail = patch.email ? normalizeEmail(patch.email) : normalizeEmail(current.email);
        if (!nextEmail) {
          throw new AppError(400, 'Email is required for admins.');
        }

        const emailOwner = await fetchOne('SELECT id FROM users WHERE email = ? AND id <> ?', [nextEmail, userId]);
        if (emailOwner) {
          throw new AppError(409, 'Admin email already exists.');
        }

        if (patch.password) {
          const nextPassword = String(patch.password);
          if (nextPassword.length < 8) {
            throw new AppError(400, 'Password must be at least 8 characters long.');
          }
          const { salt, hash } = hashPassword(nextPassword);
          nextPasswordHash = `${salt}:${hash}`;
        } else if (!nextPasswordHash) {
          throw new AppError(400, 'Password is required for admin accounts.');
        }

        nextPhone = null;
      }

      await query(
        `
          UPDATE users
          SET role = ?, name = ?, phone = ?, email = ?, password_hash = ?, status = ?
          WHERE id = ?
        `,
        [nextRole, nextName, nextPhone, nextEmail, nextPasswordHash, nextStatus, userId],
      );

      return getUserById(userId);
    },
    () => updateUserByAdminLocal(userId, patch),
  );
}

export async function deleteUserByAdmin(userId, actorUserId) {
  return withLocalFallback(
    async () => {
      if (userId === actorUserId) {
        throw new AppError(400, 'You cannot delete your own admin account.');
      }

      const current = await fetchOne('SELECT * FROM users WHERE id = ?', [userId]);
      if (!current) {
        throw new AppError(404, 'User not found.');
      }

      await query('DELETE FROM users WHERE id = ?', [userId]);
      return sanitizeUser(current);
    },
    () => deleteUserByAdminLocal(userId, actorUserId),
  );
}
