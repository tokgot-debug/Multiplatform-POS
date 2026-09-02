import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { callFunction } from '../services/firebase';
import { ROLE_CODES } from '../services/roles';

export class UsersView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.populateUsers();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #fff;">User Management</h2>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">Manage dashboard access and staff.</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              📄 Export CSV
            </button>
            <button id="add-user-btn" style="background: #F59E0B; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              👤+ Add User
            </button>
          </div>
        </div>

        <!-- Users Table -->
        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.2);">
                <th style="padding: 16px 24px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">User Name</th>
                <th style="padding: 16px 24px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Access Level</th>
                <th style="padding: 16px 24px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Email</th>
                <th style="padding: 16px 24px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- User Modal Overlay -->
      <div id="user-modal-overlay" class="hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 12px; width: 400px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <h3 id="user-modal-title" style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">Add User</h3>
          <form id="user-form">
            <input type="hidden" id="user-id">
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">User Name</label>
              <input type="text" id="user-name" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">Email Address (this is their login)</label>
              <input type="email" id="user-email" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
              <p style="margin: 6px 0 0 0; font-size: 11px; color: var(--text-muted);">No work inbox? Issue one, e.g. wanjiku@savahope.pos — it only has to be unique.</p>
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">Access Level (Role)</label>
              <select id="user-role" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
                <option value="Cashier">Cashier / Waiter (Level 1)</option>
                <option value="Bar Staff">Bar Staff (Level 1.5)</option>
                <option value="Store Keeper">Store Keeper (Level 2)</option>
                <option value="Supervisor">Supervisor (Level 2.5)</option>
                <option value="Store Manager">Store Manager (Level 3)</option>
                <option value="Owner">Owner (Level 4)</option>
              </select>
            </div>

            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">Password (at least 8 characters)</label>
              <input type="password" id="user-password" required minlength="8" autocomplete="new-password" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
              <p style="margin: 6px 0 0 0; font-size: 11px; color: var(--text-muted);">Hand this to them directly. On an existing user, this sets a new password.</p>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" id="cancel-user-btn" style="background: transparent; color: #fff; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Cancel</button>
              <button type="submit" style="background: #F59E0B; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer;">Save User</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  async populateUsers() {
    const tbody = document.getElementById('users-table-body');
    const users = await db.users.where('status').equals('ACTIVE').toArray();

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="padding: 24px; text-align: center; color: var(--text-muted);">No active users found.</td></tr>';
      return;
    }

    const rowsHtml = users.map(u => {
      const initial = u.name.charAt(0).toUpperCase();
      let level = 'Level 1';
      let levelColor = 'var(--accent-blue)';
      if (u.role === 'Owner') { level = 'Level 4'; levelColor = '#F59E0B'; }
      else if (u.role === 'Store Manager') { level = 'Level 3'; levelColor = 'var(--accent-purple)'; }
      else if (u.role === 'Supervisor') { level = 'Level 2'; levelColor = 'var(--accent-green)'; }

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 16px 24px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #F59E0B;">
              ${initial}
            </div>
            <span style="font-size: 14px; font-weight: 700; color: #fff;">${u.name}</span>
          </td>
          <td style="padding: 16px 24px;">
            <span style="background: rgba(255,255,255,0.1); color: ${levelColor}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700;">
              ${level}
            </span>
          </td>
          <td style="padding: 16px 24px; font-size: 13px; color: var(--text-secondary);">
            ${u.email || '-'}
          </td>
          <td style="padding: 16px 24px; text-align: right;">
            <button class="edit-user-btn" data-id="${u.id}" style="background: transparent; border: none; color: var(--accent-blue); cursor: pointer; padding: 4px;">✏️</button>
            <button class="delete-user-btn" data-id="${u.id}" style="background: transparent; border: none; color: var(--accent-rose); cursor: pointer; padding: 4px;">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
  }

  bindEvents() {
    const modal = document.getElementById('user-modal-overlay');
    const form = document.getElementById('user-form');
    
    // Add User button
    document.getElementById('add-user-btn').addEventListener('click', () => {
      document.getElementById('user-modal-title').textContent = 'Add User';
      form.reset();
      document.getElementById('user-id').value = '';
      modal.classList.remove('hidden');
    });

    // Cancel button
    document.getElementById('cancel-user-btn').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    // Handle form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('user-id').value;
      const name = document.getElementById('user-name').value;
      const email = document.getElementById('user-email').value;
      const role = document.getElementById('user-role').value;
      const password = document.getElementById('user-password').value;

      // Accounts are created by the backend, which owns the Firebase identity
      // and the claims. The till never writes a credential anywhere.
      try {
        if (id) {
          await callFunction('resetStaffPassword', { staffId: id, password });
          showNotification('Password updated. Give it to them directly.', 'success');
        } else {
          await callFunction('createStaffUser', {
            name,
            email,
            password,
            role: ROLE_CODES[role] || 'cashier'
          });
          showNotification(`${name} can now sign in with ${email}`, 'success');
        }

        modal.classList.add('hidden');
        await this.populateUsers();
      } catch (err) {
        showNotification(err.message || 'Could not save that user.', 'error');
      }
    });

    // Edit and Delete buttons (delegated event)
    document.getElementById('users-table-body').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-user-btn');
      const deleteBtn = e.target.closest('.delete-user-btn');
      
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const user = await db.users.get(id);
        if (user) {
          document.getElementById('user-modal-title').textContent = 'Edit User';
          document.getElementById('user-id').value = user.id;
          document.getElementById('user-name').value = user.name;
          document.getElementById('user-email').value = user.email || '';
          document.getElementById('user-email').readOnly = true;
          document.getElementById('user-role').value = user.role || 'Cashier';
          document.getElementById('user-password').value = '';
          modal.classList.remove('hidden');
        }
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (confirm('Disable this user? They will be signed out and cannot sign back in.')) {
          try {
            await callFunction('setStaffActive', { staffId: id, active: false });
            showNotification('User disabled', 'success');
            await this.populateUsers();
          } catch (err) {
            showNotification(err.message || 'Could not disable that user.', 'error');
          }
        }
      }
    });
  }
}
