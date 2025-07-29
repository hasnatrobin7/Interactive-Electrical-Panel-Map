// Authentication helper for ATE Monitor Interactive Map
// Loads after script.js and assumes the DOM is fully loaded.

const Auth = {
    user: null,
    loggedIn: false,
    disableEditing() {
        const ids = [
            'addRfdBtn', 'copyRfdBtn', 'pasteRfdBtn', 'lockMapBtn', 'resetDataBtn',
            'exportDataBtn', 'exportImageBtn', 'importDataBtn', 'updateRunsBtn'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = true;
                el.style.pointerEvents = 'none';
                el.style.opacity = '0.6';
            }
        });
    },
    enableEditing() {
        const ids = [
            'addRfdBtn', 'copyRfdBtn', 'pasteRfdBtn', 'lockMapBtn', 'resetDataBtn',
            'exportDataBtn', 'exportImageBtn', 'importDataBtn', 'updateRunsBtn'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = false;
                el.style.pointerEvents = '';
                el.style.opacity = '';
            }
        });
    },
    applyUser(user) {
        this.user = user;
        this.loggedIn = true;
        this.enableEditing();
        console.log('[Auth] Logged in as', user.username);
        // Persist username for other scripts
        localStorage.setItem('currentUsername', user.username);
        window.currentUsername = user.username;
        // Inject admin UI if necessary
        if (user.is_admin) {
            this.injectAdminUI();
        }
        this.injectLogoutBtn();
    },
    showError(msg) {
        const err = document.getElementById('loginError');
        if (err) {
            err.textContent = msg;
            err.style.display = 'block';
        }
    },
    injectAdminUI() {
        // Add Manage Users button only once
        if (document.getElementById('manageUsersBtn')) return;
        const headerCtrls = document.querySelector('.header-controls');
        if (!headerCtrls) return;
        const btn = document.createElement('button');
        btn.id = 'manageUsersBtn';
        btn.className = 'btn-secondary';
        btn.title = 'Manage Users';
        btn.innerHTML = '<i class="fas fa-users-cog"></i> Users';
        headerCtrls.appendChild(btn);
        btn.addEventListener('click', openUserAdminModal);
    },
    injectLogoutBtn(){
        if(document.getElementById('logoutBtn')) return;
        const headerCtrls = document.querySelector('.header-controls');
        if(!headerCtrls) return;
        const btn = document.createElement('button');
        btn.id = 'logoutBtn';
        btn.className = 'btn-secondary';
        btn.title = 'Logout';
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        headerCtrls.appendChild(btn);
        btn.addEventListener('click', ()=>{
            fetch('/api/logout',{method:'POST'}).finally(()=>{
                this.handleLoggedOut();
            });
        });
    },
    handleLoggedOut(){
        this.loggedIn = false;
        this.user = null;
        localStorage.removeItem('currentUsername');
        window.currentUsername = null;
        this.disableEditing();
        // Remove logout & admin buttons if present
        document.getElementById('logoutBtn')?.remove();
        document.getElementById('manageUsersBtn')?.remove();
        showLoginModal();
    }
};

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'block';
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function checkSession() {
    fetch('/api/session')
        .then(res => {
            if (!res.ok) throw new Error('unauth');
            return res.json();
        })
        .then(data => {
            if (data && data.user) {
                Auth.applyUser(data.user);
            } else {
                throw new Error('no user');
            }
        })
        .catch(() => {
            Auth.loggedIn = false;
            Auth.disableEditing();
            showLoginModal();
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // Attach login button handler
    const loginBtn = document.getElementById('loginSubmitBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            if (!username || !password) {
                Auth.showError('Please fill in both fields.');
                return;
            }
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
                .then(res => res.json().then(data => ({ status: res.status, data })))
                .then(({ status, data }) => {
                    if (status === 200 && data.user) {
                        hideLoginModal();
                        Auth.applyUser(data.user);
                    } else {
                        Auth.showError(data?.message || 'Invalid credentials');
                    }
                })
                .catch(() => Auth.showError('Login failed, try again.'));
        });
    }

    // Close modal when clicking outside content
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                // Prevent closing without login
                Auth.showError('Please login to continue.');
            }
        });
    }

    checkSession();

    // User admin modal logic
    window.openUserAdminModal = function() {
        const modal = document.getElementById('userModal');
        if (!modal) return;
        modal.style.display = 'block';
        loadUserList();
    };

    function closeUserAdminModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.style.display = 'none';
        clearUserForm();
    }

    function loadUserList() {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => {
                const tbody = document.getElementById('usersTable');
                if (!tbody) return;
                tbody.innerHTML = '';
                (data.users || []).forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${u.username}</td>
                        <td>${u.is_admin ? 'Yes' : ''}</td>
                        <td>${Object.keys(u.permissions || {}).filter(k=>u.permissions[k]).join(', ')}</td>
                        <td><button class="btn-secondary" data-edit="${u.id}">Edit</button> <button class="btn-secondary" data-del="${u.id}">Delete</button></td>
                    `;
                    tbody.appendChild(tr);
                });
                // Attach edit/delete listeners
                tbody.querySelectorAll('button[data-edit]').forEach(btn => {
                    btn.addEventListener('click', () => populateUserForm(btn.dataset.edit));
                });
                tbody.querySelectorAll('button[data-del]').forEach(btn => {
                    btn.addEventListener('click', () => deleteUser(btn.dataset.del));
                });
            });
    }

    let editingUserId = null;

    function clearUserForm() {
        editingUserId = null;
        document.getElementById('editUsername').value = '';
        document.getElementById('editPassword').value = '';
        document.getElementById('editIsAdmin').checked = false;
        ['permEdit','permUpload','permManage'].forEach(id=>document.getElementById(id).checked=false);
    }

    function populateUserForm(id) {
        fetch('/api/users')
            .then(res=>res.json())
            .then(data=>{
                const u = (data.users||[]).find(x=>x.id==id);
                if(!u) return;
                editingUserId = u.id;
                document.getElementById('editUsername').value = u.username;
                document.getElementById('editPassword').value = '';
                document.getElementById('editIsAdmin').checked = u.is_admin;
                const perms = u.permissions||{};
                document.getElementById('permEdit').checked = !!perms.edit;
                document.getElementById('permUpload').checked = !!perms.upload_runs;
                document.getElementById('permManage').checked = !!perms.manage_users;
            });
    }

    function gatherPermissions() {
        return {
            edit: document.getElementById('permEdit').checked,
            upload_runs: document.getElementById('permUpload').checked,
            manage_users: document.getElementById('permManage').checked
        };
    }

    function saveUser() {
        const username = document.getElementById('editUsername').value.trim();
        const password = document.getElementById('editPassword').value.trim();
        const is_admin = document.getElementById('editIsAdmin').checked;
        const perms = gatherPermissions();
        if (!username) {
            alert('Username required');
            return;
        }
        if (!editingUserId) {
            // create
            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, is_admin, permissions: perms })
            }).then(()=>{ clearUserForm(); loadUserList(); });
        } else {
            // update
            fetch('/api/users/' + editingUserId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, is_admin, permissions: perms })
            }).then(()=>{ clearUserForm(); loadUserList(); });
        }
    }

    function deleteUser(id){
        if(!confirm('Delete this user?')) return;
        fetch('/api/users/' + id, { method: 'DELETE' })
            .then(()=> loadUserList());
    }

    const saveUserBtn = document.getElementById('saveUserBtn');
    if(saveUserBtn){ saveUserBtn.addEventListener('click', saveUser); }

    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    if(closeUserModalBtn){ closeUserModalBtn.addEventListener('click', closeUserAdminModal); }

    // Close modal when clicking outside
    const userModal = document.getElementById('userModal');
    if(userModal){
        userModal.addEventListener('click', e=>{ if(e.target===userModal){ closeUserAdminModal(); }});
    }
}); 