import { Env } from './types';
import { DatabaseService } from './database';

/**
 * Admin Helper Functions
 * These functions help manage the directory without a full admin panel
 */

// Simple session validation - in production, use proper session management
function validateSession(request: Request, env: Env): boolean {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;

  const sessionMatch = cookie.match(/admin_session=([^;]+)/);
  if (!sessionMatch) return false;

  // Session token is just the admin key for simplicity
  // In production, use proper session tokens with expiration
  return sessionMatch[1] === env.ADMIN_KEY;
}

export async function handleAdminPage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle login POST
  if (path === '/admin/login' && request.method === 'POST') {
    const formData = await request.formData();
    const username = formData.get('username')?.toString();
    const password = formData.get('password')?.toString();

    // Check credentials (username: admin, password: ADMIN_KEY)
    if (username === 'admin' && password === env.ADMIN_KEY) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin',
          'Set-Cookie': `admin_session=${env.ADMIN_KEY}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
        }
      });
    } else {
      return new Response(loginPageHTML('Invalid username or password'), {
        status: 401,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // Handle logout
  if (path === '/admin/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin',
        'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
      }
    });
  }

  // Check if user is authenticated
  if (!validateSession(request, env)) {
    return new Response(loginPageHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // User is authenticated, proceed with admin actions
  const action = url.searchParams.get('action');
  const db = new DatabaseService(env.DB);

  if (action === 'pending-submissions') {
    return await getPendingSubmissions(db);
  }

  // Manage businesses UI (supports ?page= and ?q=)
  if (action === 'manage-businesses') {
    const page = url.searchParams.get('page') || '1';
    const q = url.searchParams.get('q') || '';
    return await manageBusinessesPage(db, Number(page), q);
  }

  // Business JSON endpoint for editor
  if (action === 'business-json') {
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
    return await getBusinessJson(id, db);
  }

  if (action === 'approve' && request.method === 'POST') {
    const submissionId = url.searchParams.get('id');
    return await approveSubmission(submissionId!, db);
  }

  // Save (create or update) business
  if (action === 'save-business' && request.method === 'POST') {
    const businessId = url.searchParams.get('id');
    return await saveBusiness(request, businessId || undefined, db);
  }

  // Delete business
  if (action === 'delete-business' && request.method === 'POST') {
    const businessId = url.searchParams.get('id');
    return await deleteBusiness(businessId!, db);
  }

  if (action === 'reject' && request.method === 'POST') {
    const submissionId = url.searchParams.get('id');
    const notes = url.searchParams.get('notes');
    return await rejectSubmission(submissionId!, notes || '', db);
  }

  if (action === 'stats') {
    return await getDetailedStats(db);
  }

  if (action === 'pending-leads') {
    return await getPendingLeads(db);
  }

  if (action === 'forward-lead' && request.method === 'POST') {
    const leadId = url.searchParams.get('id');
    return await forwardLead(leadId!, db, env);
  }

  if (action === 'close-lead' && request.method === 'POST') {
    const leadId = url.searchParams.get('id');
    return await closeLead(leadId!, db);
  }

  if (action === 'all-businesses') {
    return await getAllBusinesses(db);
  }

  if (action === 'toggle-featured' && request.method === 'POST') {
    const businessId = url.searchParams.get('id');
    return await toggleFeatured(businessId!, db);
  }

  // Blog Generator Routes
  if (action === 'blog-generator') {
    return await blogGeneratorPage(db);
  }

  if (action === 'generate-blog' && request.method === 'POST') {
    return await generateBlogContent(request, db, env);
  }

  if (action === 'manage-blogs') {
    const page = url.searchParams.get('page') || '1';
    return await manageBlogsPage(db, Number(page));
  }

  if (action === 'blog-json') {
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
    return await getBlogJson(id, db);
  }

  if (action === 'save-blog' && request.method === 'POST') {
    const blogId = url.searchParams.get('id');
    return await saveBlog(request, blogId || undefined, db);
  }

  if (action === 'delete-blog' && request.method === 'POST') {
    const blogId = url.searchParams.get('id');
    return await deleteBlogAction(blogId!, db);
  }

  if (action === 'toggle-blog-publish' && request.method === 'POST') {
    const blogId = url.searchParams.get('id');
    return await toggleBlogPublish(blogId!, db);
  }

  // Admin dashboard HTML
  return new Response(adminDashboardHTML(), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function getPendingSubmissions(db: DatabaseService): Promise<Response> {
  const { results } = await db.db
    .prepare('SELECT * FROM business_submissions WHERE status = ?')
    .bind('pending')
    .all();

  return Response.json({
    pending: results,
    count: results?.length || 0
  });
}

// Manage businesses HTML page
async function manageBusinessesPage(db: DatabaseService, page: number = 1, q: string = ''): Promise<Response> {
  const pageSize = 20;
  const offset = Math.max(0, page - 1) * pageSize;

  // Build search SQL
  let where = '';
  const bindings: any[] = [];
  if (q && q.length > 0) {
    where = 'WHERE name LIKE ? OR city LIKE ? OR state LIKE ?';
    bindings.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const countRow = await db.db.prepare(`SELECT COUNT(*) as total FROM businesses ${where}`).bind(...bindings).first<{ total: number }>();
  const total = countRow?.total || 0;

  const { results } = await db.db
    .prepare(`SELECT id, name, slug, city, state, is_featured, is_active, category_id FROM businesses ${where} ORDER BY name LIMIT ? OFFSET ?`)
    .bind(...bindings, pageSize, offset)
    .all();

  const businesses = results || [];

  // Load categories for the editor select
  const categoriesList = await db.getAllCategories();
  const categoryOptions = categoriesList.map((c: any) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const rows = businesses.map((b: any) => `
    <tr class="border-b">
      <td class="px-4 py-2">${b.id}</td>
      <td class="px-4 py-2">${escapeHtml(b.name)}</td>
      <td class="px-4 py-2">${escapeHtml(b.city || '')}</td>
      <td class="px-4 py-2">${escapeHtml(b.state || '')}</td>
      <td class="px-4 py-2">${b.is_featured ? 'Yes' : 'No'}</td>
      <td class="px-4 py-2">${b.is_active ? 'Active' : 'Inactive'}</td>
      <td class="px-4 py-2">
        <button type="button" data-id="${b.id}" class="edit-btn px-3 py-1 bg-blue-500 text-white rounded">Edit</button>
        <button type="button" data-id="${b.id}" class="delete-btn px-3 py-1 bg-red-500 text-white rounded">Delete</button>
      </td>
    </tr>
  `).join('');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageLinks = Array.from({length: totalPages}, (_, i) => `<a href="/admin?action=manage-businesses&page=${i+1}&q=${encodeURIComponent(q)}" class="px-2 py-1 border rounded ${i+1===page ? 'bg-gray-200' : ''}">${i+1}</a>`).join(' ');

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <script src="https://cdn.tailwindcss.com"></script>
    <title>Manage Businesses</title>
  </head>
  <body class="p-6 bg-gray-100">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold">Manage Businesses</h1>
          <form id="searchForm" method="GET" action="/admin">
            <input type="hidden" name="action" value="manage-businesses">
            <input type="text" name="q" value="${escapeHtml(q)}" placeholder="Search name, city, state" class="px-3 py-2 border rounded">
            <button class="px-3 py-2 bg-[#ED5409] text-white rounded">Search</button>
          </form>
        </div>
        <div class="flex items-center gap-4">
          <button id="addNewBtn" class="bg-green-600 text-white px-4 py-2 rounded">Add New Business</button>
          <div class="text-sm">Page: ${page} / ${totalPages} ${pageLinks}</div>
        </div>
      </div>

      <div class="bg-white rounded shadow overflow-hidden">
        <table class="w-full table-auto">
          <thead class="bg-gray-50 text-left"><tr>
            <th class="px-4 py-2">ID</th>
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">City</th>
            <th class="px-4 py-2">State</th>
            <th class="px-4 py-2">Featured</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Actions</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div id="editor" class="mt-6 bg-white p-6 rounded shadow hidden">
        <h2 id="editorTitle" class="text-xl font-bold mb-4">Edit Business</h2>
        <form id="businessForm" class="space-y-4">
          <input type="hidden" name="id" id="b_id">
          <div>
            <label class="block text-sm font-semibold">Name</label>
            <input id="b_name" name="name" class="w-full border px-3 py-2 rounded">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold">City</label>
              <input id="b_city" name="city" class="w-full border px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm font-semibold">State</label>
              <input id="b_state" name="state" class="w-full border px-3 py-2 rounded">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold">Email</label>
            <input id="b_email" name="email" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Category</label>
            <select id="b_category" name="category_id" class="w-full border px-3 py-2 rounded">
              <option value="">(None)</option>
              ${categoryOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold">Slug</label>
            <input id="b_slug" name="slug" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Description</label>
            <textarea id="b_description" name="description" class="w-full border px-3 py-2 rounded" rows="3"></textarea>
          </div>
          <div>
            <label class="block text-sm font-semibold">Website</label>
            <input id="b_website" name="website" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Image URL</label>
            <input id="b_image" name="image_url" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Phone</label>
            <input id="b_phone" name="phone" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Address Line 1</label>
            <input id="b_address1" name="address_line1" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">Address Line 2</label>
            <input id="b_address2" name="address_line2" class="w-full border px-3 py-2 rounded">
          </div>
          <div>
            <label class="block text-sm font-semibold">ZIP Code</label>
            <input id="b_zip" name="zip_code" class="w-full border px-3 py-2 rounded">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold">Latitude</label>
              <input id="b_latitude" name="latitude" type="number" step="any" class="w-full border px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm font-semibold">Longitude</label>
              <input id="b_longitude" name="longitude" type="number" step="any" class="w-full border px-3 py-2 rounded">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold">Service Area</label>
            <input id="b_service_area" name="service_area" class="w-full border px-3 py-2 rounded" placeholder="e.g., Southeast Oklahoma">
          </div>
          <div>
            <label class="block text-sm font-semibold">Facebook URL</label>
            <input id="b_facebook_url" name="facebook_url" class="w-full border px-3 py-2 rounded">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold">Facebook Rating</label>
              <input id="b_facebook_rating" name="facebook_rating" type="number" step="0.1" min="0" max="5" class="w-full border px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm font-semibold">Facebook Review Count</label>
              <input id="b_facebook_review_count" name="facebook_review_count" type="number" min="0" class="w-full border px-3 py-2 rounded">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold">Google Business URL</label>
            <input id="b_google_business_url" name="google_business_url" class="w-full border px-3 py-2 rounded">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold">Google Rating</label>
              <input id="b_google_rating" name="google_rating" type="number" step="0.1" min="0" max="5" class="w-full border px-3 py-2 rounded">
            </div>
            <div>
              <label class="block text-sm font-semibold">Google Review Count</label>
              <input id="b_google_review_count" name="google_review_count" type="number" min="0" class="w-full border px-3 py-2 rounded">
            </div>
          </div>
          <div class="flex gap-4 items-center">
            <label class="inline-flex items-center"><input type="checkbox" id="b_verified" name="is_verified" class="mr-2"> <span class="text-sm font-semibold">Verified</span></label>
            <label class="inline-flex items-center"><input type="checkbox" id="b_featured" name="is_featured" class="mr-2"> <span class="text-sm font-semibold">Featured</span></label>
            <label class="inline-flex items-center"><input type="checkbox" id="b_active" name="is_active" class="mr-2"> <span class="text-sm font-semibold">Active</span></label>
          </div>

          <!-- Save/Cancel Buttons -->
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onclick="window.closeEditor()" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">
              Cancel
            </button>
            <button type="button" onclick="window.saveForm()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <!-- Confirmation Modal -->
      <div id="confirmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <p id="confirmMessage" class="mb-4">Are you sure?</p>
          <div class="flex justify-end gap-3">
            <button id="confirmNo" class="px-4 py-2 border rounded">Cancel</button>
            <button id="confirmYes" class="px-4 py-2 bg-red-600 text-white rounded">Confirm</button>
          </div>
        </div>
      </div>

          <script>
              function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

              window.openEdit = async function(id){
                try {
                  const editor = document.getElementById('editor');
                  const title = document.getElementById('editorTitle');
                  const form = document.getElementById('businessForm');
                  if (form && form.reset) form.reset();
                  if(!id){ title.textContent='Add New Business'; const hid = document.getElementById('b_id'); if(hid) hid.value=''; editor.classList.remove('hidden'); return; }
                  title.textContent='Edit Business '+id;
                  const resp = await fetch('/admin?action=business-json&id='+id, { credentials: 'same-origin' });
                  if(!resp.ok){
                    const err = await resp.json().catch(function(){ return { error: 'Failed to load' }; });
                    alert('Failed to load business: ' + (err.error || resp.statusText));
                    return;
                  }
                  const data = await resp.json();
                  function setVal(id, val){ const el = document.getElementById(id); if(!el) return; if('value' in el) el.value = val || ''; }
                  setVal('b_id', data.id || '');
                  setVal('b_name', data.name || '');
                  setVal('b_city', data.city || '');
                  setVal('b_state', data.state || '');
                  setVal('b_email', data.email || '');
                  setVal('b_category', data.category_id || '');
                  setVal('b_slug', data.slug || '');
                  setVal('b_description', data.description || '');
                  setVal('b_website', data.website || '');
                  setVal('b_image', data.image_url || '');
                  setVal('b_phone', data.phone || '');
                  setVal('b_address1', data.address_line1 || '');
                  setVal('b_address2', data.address_line2 || '');
                  setVal('b_zip', data.zip_code || '');
                  setVal('b_latitude', data.latitude != null ? data.latitude : '');
                  setVal('b_longitude', data.longitude != null ? data.longitude : '');
                  setVal('b_service_area', data.service_area || '');
                  setVal('b_facebook_url', data.facebook_url || '');
                  setVal('b_google_business_url', data.google_business_url || '');
                  setVal('b_google_rating', data.google_rating != null ? data.google_rating : '');
                  setVal('b_google_review_count', data.google_review_count != null ? data.google_review_count : '');
                  setVal('b_facebook_rating', data.facebook_rating != null ? data.facebook_rating : '');
                  setVal('b_facebook_review_count', data.facebook_review_count != null ? data.facebook_review_count : '');
                  const v = document.getElementById('b_verified'); if(v) v.checked = data.is_verified==1 || data.is_verified===true;
                  const f = document.getElementById('b_featured'); if(f) f.checked = data.is_featured==1;
                  const a = document.getElementById('b_active'); if(a) a.checked = data.is_active==1;
                  editor.classList.remove('hidden');
                } catch (e) {
                  console.error('openEdit error', e);
                  alert('Unexpected error loading business');
                }
              }

              window.closeEditor = function(){ const ed = document.getElementById('editor'); if(ed) ed.classList.add('hidden'); }

              window.saveForm = async function(){
                try {
                  const form = document.getElementById('businessForm');
                  if(!form) return alert('Form missing');
                  const fd = new FormData(form);
                  const id = fd.get('id');

                  // Client-side validation
                  const name = String(fd.get('name') || '').trim();
                  const city = String(fd.get('city') || '').trim();
                  const state = String(fd.get('state') || '').trim();
                  if(!name){ alert('Name is required'); return; }
                  if(!city){ alert('City is required'); return; }
                  if(!state){ alert('State is required'); return; }

                  const email = String(fd.get('email') || '').trim();
                  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Invalid email address'); return; }

                  var body = {};
                  for(var pair of fd.entries()) { body[pair[0]] = pair[1]; }
                  var bv = document.getElementById('b_verified'); body.is_verified = bv && bv.checked ? '1' : '0';
                  var bf = document.getElementById('b_featured'); body.is_featured = bf && bf.checked ? '1' : '0';
                  var ba = document.getElementById('b_active'); body.is_active = ba && ba.checked ? '1' : '0';

                  const url = '/admin?action=save-business' + (id ? '&id='+encodeURIComponent(id) : '');
                  const resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type':'application/json' }, credentials: 'same-origin' });
                  var data = {};
                  try { data = await resp.json(); } catch(e){}
                  if(resp.ok){ alert('Saved'); location.reload(); } else { alert('Error: '+(data && data.error ? data.error : 'Save failed')); }
                } catch (e) {
                  console.error('saveForm error', e);
                  alert('Unexpected error saving business');
                }
              }

              // Show a custom confirmation modal before performing destructive actions
              function hideConfirm(){
                const modal = document.getElementById('confirmModal');
                if(modal) modal.classList.add('hidden');
              }

              function showConfirm(message, onConfirm){
                const modal = document.getElementById('confirmModal');
                if(!modal) return onConfirm();
                var msgEl = document.getElementById('confirmMessage'); if(msgEl) msgEl.textContent = message;
                modal.classList.remove('hidden');

                const yes = document.getElementById('confirmYes');
                const no = document.getElementById('confirmNo');

                var yesHandler = function(){ cleanup(); hideConfirm(); try { onConfirm(); } catch(e){ console.error(e); alert('Action failed'); } };
                var noHandler = function(){ cleanup(); hideConfirm(); };
                function cleanup(){ if(yes) yes.removeEventListener('click', yesHandler); if(no) no.removeEventListener('click', noHandler); }
                if(yes) yes.addEventListener('click', yesHandler);
                if(no) no.addEventListener('click', noHandler);
              }

              window.deleteBusiness = async function(id){
                // Defensive: ensure id is a valid number before proceeding
                var idNum = id ? Number(id) : NaN;
                if (isNaN(idNum)) {
                  console.warn('deleteBusiness called with invalid id:', id);
                  return;
                }

                showConfirm('Are you sure you want to delete business #' + idNum + '?', async function(){
                  try {
                    const resp = await fetch('/admin?action=delete-business&id='+idNum, { method: 'POST', credentials: 'same-origin' });
                    var data = {};
                    try { data = await resp.json(); } catch(e){}
                    if(resp.ok){ alert('Deleted'); location.reload(); } else { alert('Delete failed: ' + (data.error||resp.statusText)); }
                  } catch (e) {
                    console.error('deleteBusiness error', e);
                    alert('Unexpected error deleting business');
                  }
                });
              }

              // Attach event listeners - matching working blog management pattern
              document.getElementById('addNewBtn').addEventListener('click', function() {
                if (window.openEdit) window.openEdit();
              });

              document.querySelectorAll('.edit-btn').forEach(function(el) {
                el.addEventListener('click', function(e) {
                  const id = e.currentTarget.getAttribute('data-id');
                  if (id && window.openEdit) window.openEdit(Number(id));
                });
              });

              document.querySelectorAll('.delete-btn').forEach(function(el) {
                el.addEventListener('click', function(e) {
                  const id = e.currentTarget.getAttribute('data-id');
                  if (id && window.deleteBusiness) window.deleteBusiness(Number(id));
                });
              });
            </script>
  </body>
  </html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// Return JSON for a single business (used by admin editor)
async function getBusinessJson(id: string, db: DatabaseService): Promise<Response> {
  const business = await db.db.prepare('SELECT * FROM businesses WHERE id = ?').bind(id).first();
  if(!business) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(business);
}

// Save business (create or update). Expects JSON body.
async function saveBusiness(request: Request, id: string | undefined, db: DatabaseService): Promise<Response> {
  try {
    const data = await request.json() as any;
    if(id) {
      // Update
      const updates: any = {
        name: data.name,
        slug: data.slug,
        description: data.description,
        category_id: data.category_id ? Number(data.category_id) : undefined,
        city: data.city,
        state: data.state,
        email: data.email,
        phone: data.phone,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        zip_code: data.zip_code,
        latitude: data.latitude ? Number(data.latitude) : undefined,
        longitude: data.longitude ? Number(data.longitude) : undefined,
        service_area: data.service_area,
        facebook_url: data.facebook_url,
        google_business_url: data.google_business_url,
        google_rating: data.google_rating !== undefined && data.google_rating !== '' ? Number(data.google_rating) : undefined,
        google_review_count: data.google_review_count !== undefined && data.google_review_count !== '' ? Number(data.google_review_count) : undefined,
        facebook_rating: data.facebook_rating !== undefined && data.facebook_rating !== '' ? Number(data.facebook_rating) : undefined,
        facebook_review_count: data.facebook_review_count !== undefined && data.facebook_review_count !== '' ? Number(data.facebook_review_count) : undefined,
        website: data.website,
        image_url: data.image_url,
        is_verified: data.is_verified == '1' || data.is_verified == true || data.is_verified == 'on',
        is_featured: data.is_featured == '1' || data.is_featured == 1,
        is_active: data.is_active == '1' || data.is_active == 1
      };
      await db.updateBusiness(Number(id), updates);
      return Response.json({ success: true });
    } else {
      // Create with validation
      if(!data.name || !data.city || !data.state) {
        return Response.json({ error: 'Missing required fields: name, city, state' }, { status: 400 });
      }
      const slug = data.slug && data.slug.length ? String(data.slug).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : (String(data.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
      const businessId = await db.createBusiness({
        name: data.name,
        slug,
        description: data.description,
        category_id: data.category_id ? Number(data.category_id) : undefined,
        city: data.city,
        state: data.state,
        email: data.email,
        phone: data.phone,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        zip_code: data.zip_code,
        latitude: data.latitude ? Number(data.latitude) : undefined,
        longitude: data.longitude ? Number(data.longitude) : undefined,
        service_area: data.service_area,
        facebook_url: data.facebook_url,
        google_business_url: data.google_business_url,
        google_rating: data.google_rating ? Number(data.google_rating) : undefined,
        google_review_count: data.google_review_count ? Number(data.google_review_count) : undefined,
        facebook_rating: data.facebook_rating ? Number(data.facebook_rating) : undefined,
        facebook_review_count: data.facebook_review_count ? Number(data.facebook_review_count) : undefined,
        website: data.website,
        image_url: data.image_url,
        is_featured: data.is_featured == '1' || data.is_featured == 1,
        is_active: data.is_active == '1' || data.is_active == 1,
        is_verified: data.is_verified == '1' || data.is_verified == true || data.is_verified == 'on'
      });
      return Response.json({ success: true, id: businessId });
    }
  } catch (err) {
    console.error('Error saving business:', err);
    return Response.json({ error: (err instanceof Error) ? err.message : 'Save failed' }, { status: 500 });
  }
}

// Delete business by id
async function deleteBusiness(id: string, db: DatabaseService): Promise<Response> {
  try {
    await db.deleteBusiness(Number(id));
    return Response.json({ success: true });
  } catch (err) {
    console.error('Error deleting business:', err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}

// Simple HTML escape helper
function escapeHtml(input: any): string { return String(input || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function approveSubmission(id: string, db: DatabaseService): Promise<Response> {
  try {
    const submission = await db.db
      .prepare('SELECT * FROM business_submissions WHERE id = ?')
      .bind(id)
      .first();

    if (!submission) {
      return Response.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Create slug from business name
    let slug = (submission.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug already exists, if so, append a number
    const existing = await db.db
      .prepare('SELECT COUNT(*) as count FROM businesses WHERE slug = ?')
      .bind(slug)
      .first<{ count: number }>();

    if (existing && existing.count > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    // Parse any extra submission_data (we stored the full submission JSON)
    let extra: any = {};
    try { extra = submission.submission_data ? JSON.parse(String(submission.submission_data)) : {}; } catch (e) { extra = {}; }

    // Create business - include optional social/review/geolocation fields if provided
    await db.createBusiness({
      name: String(submission.name),
      slug,
      description: submission.description ? String(submission.description) : undefined,
      category_id: submission.category_id != null ? Number(submission.category_id) : undefined,
      email: submission.email ? String(submission.email) : (extra.email || undefined),
      phone: submission.phone ? String(submission.phone) : (extra.phone || undefined),
      website: submission.website ? String(submission.website) : (extra.website || undefined),
      address_line1: submission.address ? String(submission.address) : (extra.address || extra.address_line1 || undefined),
      address_line2: extra.address_line2 || undefined,
      zip_code: extra.zip_code || undefined,
      city: String(submission.city),
      state: String(submission.state),
      latitude: extra.latitude ? Number(extra.latitude) : undefined,
      longitude: extra.longitude ? Number(extra.longitude) : undefined,
      service_area: extra.service_area || undefined,
      facebook_url: extra.facebook_url ? String(extra.facebook_url) : undefined,
      google_business_url: extra.google_business_url || undefined,
      google_rating: extra.google_rating ? Number(extra.google_rating) : undefined,
      google_review_count: extra.google_review_count ? Number(extra.google_review_count) : undefined,
      facebook_rating: extra.facebook_rating ? Number(extra.facebook_rating) : undefined,
      facebook_review_count: extra.facebook_review_count ? Number(extra.facebook_review_count) : undefined,
      is_verified: extra.is_verified ? true : undefined,
      is_active: true
    });

    // Update submission status
    await db.db
      .prepare('UPDATE business_submissions SET status = ?, processed_at = ? WHERE id = ?')
      .bind('approved', Math.floor(Date.now() / 1000), id)
      .run();

    return Response.json({ success: true, slug });
  } catch (error) {
    console.error('Error approving submission:', error);
    return Response.json({
      error: 'Failed to approve submission',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function rejectSubmission(id: string, notes: string, db: DatabaseService): Promise<Response> {
  const submission = await db.db
    .prepare('SELECT * FROM business_submissions WHERE id = ?')
    .bind(id)
    .first();

  if (!submission) {
    return Response.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Update submission status to rejected
  await db.db
    .prepare('UPDATE business_submissions SET status = ?, admin_notes = ?, processed_at = ? WHERE id = ?')
    .bind('rejected', notes, Math.floor(Date.now() / 1000), id)
    .run();

  return Response.json({ success: true });
}

async function getDetailedStats(db: DatabaseService): Promise<Response> {
  const stats = await db.getStats();

  const pendingCount = await db.db
    .prepare('SELECT COUNT(*) as count FROM business_submissions WHERE status = ?')
    .bind('pending')
    .first<{ count: number }>();

  const blogCount = await db.db
    .prepare('SELECT COUNT(*) as count FROM blog_posts WHERE is_published = 1')
    .first<{ count: number }>();

  const featuredCount = await db.db
    .prepare('SELECT COUNT(*) as count FROM businesses WHERE is_featured = 1 AND is_active = 1')
    .first<{ count: number }>();

  const leadsCount = await db.db
    .prepare('SELECT COUNT(*) as count FROM contact_leads WHERE status = ?')
    .bind('new')
    .first<{ count: number }>();

  return Response.json({
    ...stats,
    pendingSubmissions: pendingCount?.count || 0,
    publishedBlogs: blogCount?.count || 0,
    featuredBusinesses: featuredCount?.count || 0,
    pendingLeads: leadsCount?.count || 0
  });
}

async function getPendingLeads(db: DatabaseService): Promise<Response> {
  const leads = await db.getPendingLeads(100);

  return Response.json({
    leads,
    count: leads.length
  });
}

async function forwardLead(leadId: string, db: DatabaseService, env: Env): Promise<Response> {
  // Get lead details
  const lead = await db.db
    .prepare(`
      SELECT cl.*, b.name as business_name, b.email as business_email, b.phone as business_phone
      FROM contact_leads cl
      JOIN businesses b ON cl.business_id = b.id
      WHERE cl.id = ?
    `)
    .bind(leadId)
    .first();

  if (!lead) {
    return Response.json({ error: 'Lead not found' }, { status: 404 });
  }

  // Update lead status
  await db.db
    .prepare('UPDATE contact_leads SET status = ?, forwarded_at = ? WHERE id = ?')
    .bind('forwarded', Math.floor(Date.now() / 1000), leadId)
    .run();

  // TODO: In the future, send email/SMS notification here
  // For now, just mark as forwarded

  return Response.json({
    success: true,
    message: 'Lead marked as forwarded',
    businessEmail: lead.business_email,
    businessPhone: lead.business_phone
  });
}

async function closeLead(leadId: string, db: DatabaseService): Promise<Response> {
  await db.db
    .prepare('UPDATE contact_leads SET status = ? WHERE id = ?')
    .bind('closed', leadId)
    .run();

  return Response.json({ success: true });
}

async function getAllBusinesses(db: DatabaseService): Promise<Response> {
  const { results } = await db.db
    .prepare('SELECT id, name, slug, city, state, is_featured, is_active, google_rating FROM businesses ORDER BY name')
    .all();

  return Response.json({
    businesses: results || [],
    count: results?.length || 0
  });
}

async function toggleFeatured(businessId: string, db: DatabaseService): Promise<Response> {
  // Get current status
  const business = await db.db
    .prepare('SELECT is_featured FROM businesses WHERE id = ?')
    .bind(businessId)
    .first<{ is_featured: number }>();

  if (!business) {
    return Response.json({ error: 'Business not found' }, { status: 404 });
  }

  // Toggle featured status
  const newStatus = business.is_featured === 1 ? 0 : 1;
  await db.db
    .prepare('UPDATE businesses SET is_featured = ? WHERE id = ?')
    .bind(newStatus, businessId)
    .run();

  return Response.json({ success: true, is_featured: newStatus === 1 });
}

// ============================================================================
// BLOG GENERATOR FUNCTIONS
// ============================================================================

async function blogGeneratorPage(db: DatabaseService): Promise<Response> {
  const businesses = await db.db.prepare('SELECT id, name, city, state FROM businesses WHERE is_active = 1 ORDER BY name').all();
  const categories = await db.getAllCategories();
  const cities = await db.db.prepare('SELECT DISTINCT city FROM businesses WHERE is_active = 1 ORDER BY city').all();

  const businessOptions = (businesses.results || []).map((b: any) =>
    `<option value="${b.id}">${escapeHtml(b.name)} - ${escapeHtml(b.city)}, ${escapeHtml(b.state)}</option>`
  ).join('');

  const categoryOptions = categories.map((c: any) =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');

  const cityOptions = (cities.results || []).map((c: any) =>
    `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <title>AI Blog Generator - KiamichiBizConnect</title>
</head>
<body class="bg-gray-100">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="flex items-center gap-4 mb-6">
      <a href="/admin" class="text-[#ED5409] hover:underline">← Back to Dashboard</a>
      <h1 class="text-3xl font-bold">AI Blog Generator</h1>
    </div>

    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-bold mb-4">Quick Generate</h2>
      <p class="text-gray-600 mb-4">Select a blog type and let AI generate SEO-optimized content.</p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Blog Type</label>
          <select id="blogType" class="w-full border px-3 py-2 rounded">
            <option value="">-- Select Blog Type --</option>
            <option value="business_spotlight">Business Spotlight</option>
            <option value="category">Category Guide</option>
            <option value="service_area">Service Area Guide</option>
            <option value="business_tips">Business Tips & News</option>
          </select>
        </div>

        <div id="businessSelect" class="hidden">
          <label class="block text-sm font-semibold mb-2">Select Business</label>
          <select id="selectedBusiness" class="w-full border px-3 py-2 rounded">
            <option value="">-- Select Business --</option>
            ${businessOptions}
          </select>
        </div>

        <div id="categorySelect" class="hidden">
          <label class="block text-sm font-semibold mb-2">Select Category</label>
          <select id="selectedCategory" class="w-full border px-3 py-2 rounded">
            <option value="">-- Select Category --</option>
            ${categoryOptions}
          </select>
        </div>

        <div id="citySelect" class="hidden">
          <label class="block text-sm font-semibold mb-2">Select City</label>
          <select id="selectedCity" class="w-full border px-3 py-2 rounded">
            <option value="">-- Select City --</option>
            ${cityOptions}
          </select>
        </div>

        <div id="customTopicInput" class="hidden">
          <label class="block text-sm font-semibold mb-2">Custom Topic</label>
          <input type="text" id="customTopic" class="w-full border px-3 py-2 rounded"
                 placeholder="e.g., 2025 Digital Marketing Trends">
        </div>

        <button onclick="generateBlog()" class="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 w-full font-bold">
          Generate Blog Post
        </button>
      </div>
    </div>

    <div id="generatingIndicator" class="hidden bg-blue-100 border-l-4 border-blue-500 p-4 mb-6">
      <p class="font-semibold">Generating blog post...</p>
      <p class="text-sm text-gray-600">This may take 30-60 seconds. Please wait.</p>
    </div>

    <div id="preview" class="hidden bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-bold mb-4">Preview & Edit</h2>
      <form id="blogForm" class="space-y-4">
        <input type="hidden" id="blog_id">
        <div>
          <label class="block text-sm font-semibold mb-2">Title</label>
          <input type="text" id="blog_title" class="w-full border px-3 py-2 rounded" required>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Slug (URL)</label>
          <input type="text" id="blog_slug" class="w-full border px-3 py-2 rounded" required>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Excerpt (Meta Description)</label>
          <textarea id="blog_excerpt" rows="2" class="w-full border px-3 py-2 rounded"></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Content (Markdown)</label>
          <textarea id="blog_content" rows="20" class="w-full border px-3 py-2 rounded font-mono text-sm" required></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Featured Image URL (optional)</label>
          <input type="text" id="blog_image" class="w-full border px-3 py-2 rounded">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Author</label>
          <input type="text" id="blog_author" class="w-full border px-3 py-2 rounded" value="KiamichiBizConnect">
        </div>
        <div>
          <label class="inline-flex items-center">
            <input type="checkbox" id="blog_published" class="mr-2">
            <span class="text-sm font-semibold">Publish immediately</span>
          </label>
        </div>

        <div class="flex gap-3">
          <button type="button" onclick="saveBlogPost()" class="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-bold">
            Save Blog Post
          </button>
          <button type="button" onclick="resetForm()" class="bg-gray-600 text-white px-6 py-3 rounded hover:bg-gray-700">
            Reset
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const blogTypeSelect = document.getElementById('blogType');
    const businessSelectDiv = document.getElementById('businessSelect');
    const categorySelectDiv = document.getElementById('categorySelect');
    const citySelectDiv = document.getElementById('citySelect');
    const customTopicDiv = document.getElementById('customTopicInput');

    blogTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      businessSelectDiv.classList.add('hidden');
      categorySelectDiv.classList.add('hidden');
      citySelectDiv.classList.add('hidden');
      customTopicDiv.classList.add('hidden');

      if (type === 'business_spotlight') businessSelectDiv.classList.remove('hidden');
      if (type === 'category') categorySelectDiv.classList.remove('hidden');
      if (type === 'service_area') citySelectDiv.classList.remove('hidden');
      if (type === 'business_tips') customTopicDiv.classList.remove('hidden');
    });

    async function generateBlog() {
      const type = document.getElementById('blogType').value;
      if (!type) { alert('Please select a blog type'); return; }

      let params = { type };
      if (type === 'business_spotlight') {
        const bizId = document.getElementById('selectedBusiness').value;
        if (!bizId) { alert('Please select a business'); return; }
        params.business_id = bizId;
      } else if (type === 'category') {
        const catId = document.getElementById('selectedCategory').value;
        if (!catId) { alert('Please select a category'); return; }
        params.category_id = catId;
      } else if (type === 'service_area') {
        const city = document.getElementById('selectedCity').value;
        if (!city) { alert('Please select a city'); return; }
        params.city = city;
      } else if (type === 'business_tips') {
        const topic = document.getElementById('customTopic').value.trim();
        if (!topic) { alert('Please enter a topic'); return; }
        params.topic = topic;
      }

      document.getElementById('generatingIndicator').classList.remove('hidden');
      document.getElementById('preview').classList.add('hidden');

      try {
        const resp = await fetch('/admin?action=generate-blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(params)
        });

        const data = await resp.json();

        if (resp.ok) {
          document.getElementById('blog_title').value = data.title;
          document.getElementById('blog_slug').value = data.slug;
          document.getElementById('blog_excerpt').value = data.excerpt || '';
          document.getElementById('blog_content').value = data.content;
          document.getElementById('blog_image').value = data.featured_image || '';
          document.getElementById('preview').classList.remove('hidden');
        } else {
          alert('Error generating blog: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Failed to generate blog: ' + e.message);
      } finally {
        document.getElementById('generatingIndicator').classList.add('hidden');
      }
    }

    async function saveBlogPost() {
      const title = document.getElementById('blog_title').value.trim();
      const slug = document.getElementById('blog_slug').value.trim();
      const content = document.getElementById('blog_content').value.trim();

      if (!title || !slug || !content) { alert('Title, slug, and content are required'); return; }

      const body = {
        title,
        slug,
        excerpt: document.getElementById('blog_excerpt').value.trim(),
        content,
        featured_image: document.getElementById('blog_image').value.trim(),
        author: document.getElementById('blog_author').value.trim(),
        is_published: document.getElementById('blog_published').checked
      };

      try {
        const resp = await fetch('/admin?action=save-blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body)
        });

        const data = await resp.json();
        if (resp.ok) {
          alert('Blog post saved successfully!');
          window.location.href = '/admin?action=manage-blogs';
        } else {
          alert('Error saving blog: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Failed to save blog: ' + e.message);
      }
    }

    function resetForm() {
      document.getElementById('blogForm').reset();
      document.getElementById('preview').classList.add('hidden');
      document.getElementById('blogType').value = '';
      blogTypeSelect.dispatchEvent(new Event('change'));
    }
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function generateBlogContent(request: Request, db: DatabaseService, env: Env): Promise<Response> {
  try {
    const params = await request.json() as any;
    const { type } = params;

    let prompt = '';
    let title = '';
    let slug = '';
    let excerpt = '';
    let featured_image = '';

    if (type === 'business_spotlight') {
      const business = await db.db.prepare('SELECT * FROM businesses WHERE id = ?').bind(params.business_id).first();
      if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

      title = `Spotlight: ${business.name} - ${business.city}'s Premier ${business.category_id ? 'Business' : 'Service'}`;
      slug = `spotlight-${(business as any).slug}`;
      excerpt = `Discover ${business.name} in ${business.city}, ${business.state}. ${business.description || 'A trusted local business serving the community.'}`.substring(0, 160);
      featured_image = (business as any).image_url || '';

      prompt = `Write a 600-word SEO-optimized blog post featuring ${business.name}, a business located in ${business.city}, ${business.state}.

Business Details:
- Name: ${business.name}
- Location: ${business.city}, ${business.state}
${(business as any).google_rating ? `- Rating: ${(business as any).google_rating} stars (${(business as any).review_count || 0} reviews)` : ''}
${business.description ? `- Services: ${business.description}` : ''}
${(business as any).website ? `- Website: ${(business as any).website}` : ''}

Include:
1. Opening paragraph highlighting what makes this business special and its community connection
2. Services they offer with specific local details (e.g., "They handle the unique red-clay plumbing issues common in Southeast Oklahoma")
3. Why local customers love them (mention rating if available)
4. Quote a unique insight from the business owner about industry trends in the ${business.city} area
5. How to contact them with clear NAP (Name, Address, Phone)
6. Call-to-action encouraging readers to visit

Tone: Friendly, local, supportive of small businesses
SEO Focus: Use these long-tail keywords naturally: "${business.city} ${business.description || 'business'}", "local business ${business.city}", "best ${business.description || 'services'} near me"
H-Tag Structure: Use minimum 3 H2 headings and 5 H3 subheadings for SEO
Format: Markdown with ## for H2, ### for H3
Internal Linking: Suggest linking to our category page for their industry

Write the blog post now in markdown format:`;

    } else if (type === 'category') {
      const category = await db.db.prepare('SELECT * FROM categories WHERE id = ?').bind(params.category_id).first();
      if (!category) return Response.json({ error: 'Category not found' }, { status: 404 });

      const categoryBusinesses = await db.getBusinessesByCategory((category as any).slug, 5);

      title = `Complete Guide to ${(category as any).name} Services in Southeast Oklahoma 2025`;
      slug = `guide-${(category as any).slug}-southeast-oklahoma`;
      excerpt = `Find the best ${(category as any).name} services in Southeast Oklahoma. Expert guide with tips for choosing providers and featured local businesses.`;

      const businessList = categoryBusinesses.map((b: any) => `- ${b.name} (${b.city}, ${b.state})`).join('\n');

      prompt = `Write a comprehensive 1200-word SEO-optimized educational blog post about ${(category as any).name} services in Southeast Oklahoma, Northeast Texas, and Southwest Arkansas.

Include:
1. Introduction to ${(category as any).name} services in the region (200 words)
2. What to look for when choosing a ${(category as any).name} provider (minimum 4 H2 sections, 8 H3 subsections)
3. Common questions people have about ${(category as any).name} (generate 5 FAQ-style questions with clear answers)
4. Why supporting local ${(category as any).name} businesses matters
5. Featured local businesses from KiamichiBizConnect (mention these):
${businessList}

SEO Requirements:
- Target 2-3 long-tail keywords like "best ${(category as any).name} Southeast Oklahoma", "how to choose ${(category as any).name} Broken Bow", "affordable ${(category as any).name} Valliant"
- H-Tag Structure: Minimum 4 H2 headings, 8 H3 subheadings
- Ensure featured businesses are from at least 3 different towns
- Naturally integrate micro-location keywords (Hochatown, Fort Towson, Hugo)

Tone: Educational, helpful, community-focused
Focus: 2025 trends, local expertise, practical advice
Format: Markdown with ## for H2, ### for H3

Write the blog post now in markdown format:`;

    } else if (type === 'service_area') {
      const city = params.city;
      const cityBusinesses = await db.db.prepare('SELECT * FROM businesses WHERE city = ? AND is_active = 1 LIMIT 5').bind(city).all();

      title = `Best Local Businesses in ${city}, Oklahoma - 2025 Community Guide`;
      slug = `local-businesses-${city.toLowerCase().replace(/\s+/g, '-')}`;
      excerpt = `Discover the best local businesses in ${city}, Oklahoma. Support your community while finding trusted services and shops.`;

      const businessList = (cityBusinesses.results || []).map((b: any) => `- ${b.name} - ${b.description || 'Trusted local business'}`).join('\n');

      prompt = `Write a 700-word article about local businesses serving ${city}, Oklahoma and the surrounding area.

Include:
1. Overview of the local business community in ${city} (150 words)
2. Economic importance of supporting local (100 words)
3. Featured businesses in the area:
${businessList}
4. What makes ${city} special for entrepreneurs and business owners
5. How to discover more local businesses on KiamichiBizConnect

SEO Requirements:
- Target long-tail keywords: "${city} businesses", "local shopping ${city}", "support local ${city} Oklahoma"
- Naturally integrate 3-5 nearby neighborhoods/landmarks to expand geographic relevance
- Tie the business community's support to a recent or upcoming local event
- Include links to 2-3 specific business spotlights

Tone: Community-proud, informative, encouraging
Focus: 2025 local economy, community support
Format: Markdown with ## for H2, ### for H3

Write the blog post now in markdown format:`;

    } else if (type === 'business_tips') {
      const topic = params.topic;
      title = topic;
      slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      excerpt = `Expert tips and insights about ${topic} for small businesses in Southeast Oklahoma.`;

      prompt = `Write an 800-word informative blog post about: ${topic}

Focus on practical, actionable advice for small businesses in Southeast Oklahoma, Northeast Texas, and Southwest Arkansas.

Include:
1. Introduction explaining why this topic matters for local businesses (150 words)
2. 4-5 main sections with practical tips (use H2 and H3 headings)
3. Real-world examples relevant to rural/small-town businesses
4. How local businesses can implement these strategies
5. Call-to-action encouraging businesses to list on KiamichiBizConnect

SEO Requirements:
- Target 2-3 relevant long-tail keywords
- H-Tag Structure: Minimum 4 H2 headings, 6 H3 subheadings
- Include practical, actionable advice

Tone: Professional, helpful, encouraging
Focus: 2025 trends, practical implementation
Format: Markdown with ## for H2, ### for H3

Write the blog post now in markdown format:`;
    } else {
      return Response.json({ error: 'Invalid blog type' }, { status: 400 });
    }

    // Call Workers AI
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are an expert SEO content writer specializing in local business marketing. Write engaging, informative blog posts optimized for Google search.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2500
    });

    const content = (aiResponse as any).response || '';

    return Response.json({
      title,
      slug,
      excerpt,
      content,
      featured_image
    });

  } catch (error) {
    console.error('Error generating blog:', error);
    return Response.json({
      error: 'Failed to generate blog content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function manageBlogsPage(db: DatabaseService, page: number = 1): Promise<Response> {
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const blogs = await db.getAllBlogPosts(pageSize, offset, false);
  const totalCount = await db.db.prepare('SELECT COUNT(*) as total FROM blog_posts').first<{ total: number }>();
  const total = totalCount?.total || 0;

  const rows = blogs.map((blog: any) => `
    <tr class="border-b">
      <td class="px-4 py-2">${blog.id}</td>
      <td class="px-4 py-2">
        <div class="font-semibold">${escapeHtml(blog.title)}</div>
        <div class="text-xs text-gray-500">/blog/${escapeHtml(blog.slug)}</div>
      </td>
      <td class="px-4 py-2 text-sm">${blog.author || 'KiamichiBizConnect'}</td>
      <td class="px-4 py-2 text-sm">${new Date(blog.created_at * 1000).toLocaleDateString()}</td>
      <td class="px-4 py-2">
        <span class="px-2 py-1 rounded text-xs ${blog.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
          ${blog.is_published ? 'Published' : 'Draft'}
        </span>
      </td>
      <td class="px-4 py-2 space-x-2">
        <button data-id="${blog.id}" class="edit-btn px-3 py-1 bg-blue-500 text-white rounded text-sm">Edit</button>
        <button data-id="${blog.id}" class="toggle-publish-btn px-3 py-1 ${blog.is_published ? 'bg-yellow-500' : 'bg-green-500'} text-white rounded text-sm">
          ${blog.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button data-id="${blog.id}" class="delete-btn px-3 py-1 bg-red-500 text-white rounded text-sm">Delete</button>
      </td>
    </tr>
  `).join('');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageLinks = Array.from({length: Math.min(10, totalPages)}, (_, i) => {
    const p = i + 1;
    return `<a href="/admin?action=manage-blogs&page=${p}" class="px-2 py-1 border rounded ${p===page ? 'bg-gray-200' : ''}">${p}</a>`;
  }).join(' ');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Manage Blogs - KiamichiBizConnect</title>
</head>
<body class="bg-gray-100 p-6">
  <div class="max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <a href="/admin" class="text-[#ED5409] hover:underline">← Dashboard</a>
        <h1 class="text-2xl font-bold">Manage Blog Posts</h1>
      </div>
      <a href="/admin?action=blog-generator" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
        + Generate New Blog
      </a>
    </div>

    <div class="bg-white rounded shadow overflow-hidden mb-4">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left">ID</th>
            <th class="px-4 py-2 text-left">Title</th>
            <th class="px-4 py-2 text-left">Author</th>
            <th class="px-4 py-2 text-left">Created</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No blog posts yet</td></tr>'}</tbody>
      </table>
    </div>

    <div class="text-sm">Page ${page} / ${totalPages} - ${pageLinks}</div>

    <div id="editor" class="mt-6 bg-white p-6 rounded shadow hidden">
      <h2 id="editorTitle" class="text-xl font-bold mb-4">Edit Blog Post</h2>
      <form id="blogForm" class="space-y-4">
        <input type="hidden" id="blog_id">
        <div>
          <label class="block text-sm font-semibold mb-2">Title</label>
          <input id="blog_title" class="w-full border px-3 py-2 rounded" required>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Slug</label>
          <input id="blog_slug" class="w-full border px-3 py-2 rounded" required>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Excerpt</label>
          <textarea id="blog_excerpt" rows="2" class="w-full border px-3 py-2 rounded"></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Content (Markdown)</label>
          <textarea id="blog_content" rows="20" class="w-full border px-3 py-2 rounded font-mono text-sm" required></textarea>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Featured Image URL</label>
          <input id="blog_image" class="w-full border px-3 py-2 rounded">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Author</label>
          <input id="blog_author" class="w-full border px-3 py-2 rounded">
        </div>
        <div>
          <label class="inline-flex items-center">
            <input type="checkbox" id="blog_published" class="mr-2">
            <span>Published</span>
          </label>
        </div>
        <div class="flex gap-3">
          <button type="button" onclick="saveBlog()" class="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          <button type="button" onclick="closeEditor()" class="px-4 py-2 border rounded">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div id="confirmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden">
    <div class="bg-white rounded-lg p-6 max-w-md w-full">
      <p id="confirmMessage" class="mb-4">Are you sure?</p>
      <div class="flex justify-end gap-3">
        <button id="confirmNo" class="px-4 py-2 border rounded">Cancel</button>
        <button id="confirmYes" class="px-4 py-2 bg-red-600 text-white rounded">Confirm</button>
      </div>
    </div>
  </div>

  <script>
    async function openEdit(id) {
      const resp = await fetch('/admin?action=blog-json&id='+id, { credentials: 'same-origin' });
      if (!resp.ok) { alert('Failed to load blog'); return; }

      const data = await resp.json();
      document.getElementById('blog_id').value = data.id;
      document.getElementById('blog_title').value = data.title || '';
      document.getElementById('blog_slug').value = data.slug || '';
      document.getElementById('blog_excerpt').value = data.excerpt || '';
      document.getElementById('blog_content').value = data.content || '';
      document.getElementById('blog_image').value = data.featured_image || '';
      document.getElementById('blog_author').value = data.author || '';
      document.getElementById('blog_published').checked = data.is_published == 1;
      document.getElementById('editor').classList.remove('hidden');
      document.getElementById('editorTitle').textContent = 'Edit Blog #' + id;
    }

    function closeEditor() {
      document.getElementById('editor').classList.add('hidden');
    }

    async function saveBlog() {
      const id = document.getElementById('blog_id').value;
      const body = {
        title: document.getElementById('blog_title').value,
        slug: document.getElementById('blog_slug').value,
        excerpt: document.getElementById('blog_excerpt').value,
        content: document.getElementById('blog_content').value,
        featured_image: document.getElementById('blog_image').value,
        author: document.getElementById('blog_author').value,
        is_published: document.getElementById('blog_published').checked
      };

      const url = '/admin?action=save-blog' + (id ? '&id='+id : '');
      const resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: {'Content-Type':'application/json'}, credentials: 'same-origin' });
      const data = await resp.json();
      if (resp.ok) { alert('Saved'); location.reload(); } else { alert('Error: ' + (data.error || 'Save failed')); }
    }

    function showConfirm(msg, onYes) {
      const modal = document.getElementById('confirmModal');
      document.getElementById('confirmMessage').textContent = msg;
      modal.classList.remove('hidden');

      const yes = document.getElementById('confirmYes');
      const no = document.getElementById('confirmNo');

      const cleanup = () => { yes.removeEventListener('click', yesHandler); no.removeEventListener('click', noHandler); };
      const yesHandler = async () => { cleanup(); modal.classList.add('hidden'); await onYes(); };
      const noHandler = () => { cleanup(); modal.classList.add('hidden'); };

      yes.addEventListener('click', yesHandler);
      no.addEventListener('click', noHandler);
    }

    async function deleteBlog(id) {
      showConfirm('Delete blog post #' + id + '?', async () => {
        const resp = await fetch('/admin?action=delete-blog&id='+id, { method: 'POST', credentials: 'same-origin' });
        if (resp.ok) { location.reload(); } else { alert('Delete failed'); }
      });
    }

    async function togglePublish(id) {
      const resp = await fetch('/admin?action=toggle-blog-publish&id='+id, { method: 'POST', credentials: 'same-origin' });
      if (resp.ok) { location.reload(); } else { alert('Failed to toggle publish status'); }
    }

    document.querySelectorAll('.edit-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) openEdit(Number(id));
      });
    });

    document.querySelectorAll('.delete-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) deleteBlog(Number(id));
      });
    });

    document.querySelectorAll('.toggle-publish-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) togglePublish(Number(id));
      });
    });
  </script>
</body>
</html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function getBlogJson(id: string, db: DatabaseService): Promise<Response> {
  const blog = await db.getBlogPostById(Number(id));
  if (!blog) return Response.json({ error: 'Blog not found' }, { status: 404 });
  return Response.json(blog);
}

async function saveBlog(request: Request, id: string | undefined, db: DatabaseService): Promise<Response> {
  try {
    const data = await request.json() as any;
    const slug = data.slug && data.slug.length ? String(data.slug).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') :
                 (String(data.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));

    if (id) {
      await db.updateBlogPost(Number(id), {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content,
        featured_image: data.featured_image,
        author: data.author,
        is_published: data.is_published
      });
      return Response.json({ success: true });
    } else {
      const blogId = await db.createBlogPost({
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: data.content,
        featured_image: data.featured_image,
        author: data.author || 'KiamichiBizConnect',
        is_published: data.is_published
      });
      return Response.json({ success: true, id: blogId });
    }
  } catch (err) {
    console.error('Error saving blog:', err);
    return Response.json({ error: (err instanceof Error) ? err.message : 'Save failed' }, { status: 500 });
  }
}

async function deleteBlogAction(id: string, db: DatabaseService): Promise<Response> {
  try {
    await db.deleteBlogPost(Number(id));
    return Response.json({ success: true });
  } catch (err) {
    console.error('Error deleting blog:', err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}

async function toggleBlogPublish(id: string, db: DatabaseService): Promise<Response> {
  try {
    await db.toggleBlogPublishStatus(Number(id));
    return Response.json({ success: true });
  } catch (err) {
    console.error('Error toggling blog publish status:', err);
    return Response.json({ error: 'Toggle failed' }, { status: 500 });
  }
}

function loginPageHTML(errorMessage?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - KiamichiBizConnect</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #FFCB67 0%, #ED5409 50%, #214E81 100%);
        }
    </style>
</head>
<body class="bg-gray-100">
    <div class="min-h-screen flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
            <div class="text-center mb-8">
                <img src="/logo.png" alt="KiamichiBizConnect" class="h-20 w-auto mx-auto mb-4">
                <h1 class="text-2xl font-bold text-gray-900">Admin Login</h1>
                <p class="text-gray-600 mt-2">Sign in to manage your business directory</p>
            </div>

            ${errorMessage ? `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    ${errorMessage}
                </div>
            ` : ''}

            <form method="POST" action="/admin/login" class="space-y-6">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                    <input type="text" name="username" required autofocus
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ED5409] focus:border-transparent"
                        placeholder="admin">
                </div>

                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input type="password" name="password" required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ED5409] focus:border-transparent"
                        placeholder="Enter your password">
                </div>

                <button type="submit"
                    class="w-full bg-[#ED5409] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#d64808] transition-colors">
                    Sign In
                </button>
            </form>

            <div class="mt-6 text-center text-sm text-gray-600">
                <a href="/" class="text-[#ED5409] hover:text-[#d64808]">← Back to Homepage</a>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}

function adminDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - KiamichiBizConnect</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">Admin Dashboard</h1>
            <a href="/admin/logout" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                Logout
            </a>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-gray-500 text-sm">Total Businesses</h3>
                <p class="text-3xl font-bold" id="total-businesses">-</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-gray-500 text-sm">Pending Submissions</h3>
                <p class="text-3xl font-bold text-yellow-600" id="pending-submissions">-</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-gray-500 text-sm">Pending Leads</h3>
                <p class="text-3xl font-bold text-blue-600" id="pending-leads">-</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-gray-500 text-sm">Featured Businesses</h3>
                <p class="text-3xl font-bold text-[#ED5409]" id="featured-businesses">-</p>
            </div>
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-gray-500 text-sm">Published Blogs</h3>
                <p class="text-3xl font-bold text-green-600" id="published-blogs">-</p>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-bold mb-4">Quick Actions</h2>
            <div class="flex flex-wrap gap-2">
                <a href="/admin?action=manage-businesses" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block">
                  Manage Businesses
                </a>
                <a href="/admin?action=blog-generator" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 inline-block">
                  AI Blog Generator
                </a>
                <a href="/admin?action=manage-blogs" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 inline-block">
                  Manage Blogs
                </a>
                <button onclick="loadPendingSubmissions()" class="bg-[#ED5409] text-white px-4 py-2 rounded hover:bg-[#d64808]">
                    View Pending Submissions
                </button>
                <button onclick="loadPendingLeads()" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    View Pending Leads
                </button>
                <button onclick="loadStats()" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                    Refresh Stats
                </button>
            </div>

            <div id="submissions-list" class="mt-6"></div>
            <div id="businesses-list" class="mt-6"></div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold mb-4">Lead Management</h2>
            <div id="leads-list"></div>
        </div>
    </div>

    <script>
        // Load stats on page load
        loadStats();

        async function loadStats() {
            const response = await fetch('/admin?action=stats');
            const data = await response.json();

            document.getElementById('total-businesses').textContent = data.businesses;
            document.getElementById('pending-submissions').textContent = data.pendingSubmissions;
            document.getElementById('pending-leads').textContent = data.pendingLeads;
            document.getElementById('featured-businesses').textContent = data.featuredBusinesses;
            document.getElementById('published-blogs').textContent = data.publishedBlogs;
        }

        async function loadPendingSubmissions() {
            const response = await fetch('/admin?action=pending-submissions');
            const data = await response.json();
            
            const list = document.getElementById('submissions-list');
            if (data.count === 0) {
                list.innerHTML = '<p class="text-gray-500">No pending submissions</p>';
                return;
            }

            list.innerHTML = data.pending.map(sub => \`
                <div class="border rounded p-4 mb-4 bg-white">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg">\${sub.name}</h3>
                        <div class="flex gap-1">
                            \${sub.email ? '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Email</span>' : ''}
                            \${sub.phone ? '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Phone</span>' : ''}
                            \${sub.website ? '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Website</span>' : ''}
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">\${sub.city}, \${sub.state}</p>

                    <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                        \${sub.email ? \`<div><span class="font-semibold">Email:</span> <a href="mailto:\${sub.email}" class="text-blue-600">\${sub.email}</a></div>\` : ''}
                        \${sub.phone ? \`<div><span class="font-semibold">Phone:</span> <a href="tel:\${sub.phone}" class="text-blue-600">\${sub.phone}</a></div>\` : ''}
                        \${sub.website ? \`<div><span class="font-semibold">Website:</span> <a href="\${sub.website}" target="_blank" class="text-blue-600">\${sub.website}</a></div>\` : ''}
                        \${sub.address ? \`<div><span class="font-semibold">Address:</span> \${sub.address}</div>\` : ''}
                    </div>

                    \${sub.description ? \`
                        <div class="bg-gray-50 p-3 rounded mb-3">
                            <p class="text-sm font-semibold mb-1">Description:</p>
                            <p class="text-sm text-gray-700">\${sub.description}</p>
                        </div>
                    \` : '<p class="text-sm text-gray-500 mb-3 italic">No description provided</p>'}

                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500">
                            Submitted: \${new Date(sub.created_at * 1000).toLocaleString()}
                        </span>
                        <div>
                            <button onclick="approveSubmission(\${sub.id})" class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                                ✓ Approve
                            </button>
                            <button onclick="rejectSubmission(\${sub.id})" class="bg-red-600 text-white px-4 py-2 rounded text-sm ml-2 hover:bg-red-700">
                                ✗ Reject
                            </button>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        async function approveSubmission(id) {
            const response = await fetch(\`/admin?action=approve&id=\${id}\`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                alert('Business approved! Slug: ' + data.slug);
                loadPendingSubmissions();
                loadStats();
            } else {
                alert('Error approving submission:\\n' + (data.details || data.error || 'Unknown error'));
            }
        }

        async function rejectSubmission(id) {
            const notes = prompt('Reason for rejection (optional):');
            if (notes === null) return; // User cancelled

            const response = await fetch(\`/admin?action=reject&id=\${id}&notes=\${encodeURIComponent(notes)}\`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                alert('Business submission rejected');
                loadPendingSubmissions();
                loadStats();
            } else {
                alert('Error: Failed to reject submission');
            }
        }

        async function loadPendingLeads() {
            const response = await fetch('/admin?action=pending-leads');
            const data = await response.json();

            const list = document.getElementById('leads-list');
            if (data.count === 0) {
                list.innerHTML = '<p class="text-gray-500">No pending leads</p>';
                return;
            }

            list.innerHTML = data.leads.map(lead => \`
                <div class="border rounded p-4 mb-4 bg-gray-50">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-lg">\${lead.name}</h3>
                            <p class="text-sm text-gray-600">For: <a href="/business/\${lead.business_slug}" class="text-blue-600">\${lead.business_name}</a></p>
                        </div>
                        <span class="px-2 py-1 rounded text-xs font-semibold \${
                            lead.urgency === 'asap' ? 'bg-red-100 text-red-800' :
                            lead.urgency === 'this-week' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                        }">\${lead.urgency.toUpperCase()}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                            <span class="font-semibold">Email:</span> <a href="mailto:\${lead.email}" class="text-blue-600">\${lead.email}</a>
                        </div>
                        \${lead.phone ? \`<div><span class="font-semibold">Phone:</span> <a href="tel:\${lead.phone}" class="text-blue-600">\${lead.phone}</a></div>\` : ''}
                        \${lead.service_requested ? \`<div><span class="font-semibold">Service:</span> \${lead.service_requested}</div>\` : ''}
                        <div><span class="font-semibold">Contact via:</span> \${lead.preferred_contact_method}</div>
                    </div>

                    \${lead.message ? \`
                        <div class="bg-white p-3 rounded mb-3">
                            <p class="text-sm font-semibold mb-1">Message:</p>
                            <p class="text-sm text-gray-700">\${lead.message}</p>
                        </div>
                    \` : ''}

                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500">
                            Received: \${new Date(lead.created_at * 1000).toLocaleString()}
                        </span>
                        <div>
                            \${lead.subscription_tier && lead.subscription_tier !== 'manual' ?
                                \`<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mr-2">Auto-Forward Enabled</span>\` :
                                \`<button onclick="forwardLead(\${lead.id})" class="bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">
                                    Forward to Business
                                </button>\`
                            }
                            <button onclick="closeLead(\${lead.id})" class="bg-gray-600 text-white px-3 py-1 rounded text-sm">
                                Mark Closed
                            </button>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        async function forwardLead(id) {
            if (!confirm('Forward this lead to the business?')) return;

            const response = await fetch(\`/admin?action=forward-lead&id=\${id}\`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                alert(\`Lead forwarded!\\n\\nContact the business at:\\nEmail: \${data.businessEmail}\\nPhone: \${data.businessPhone}\`);
                loadPendingLeads();
                loadStats();
            } else {
                alert('Error: ' + (data.error || 'Failed to forward lead'));
            }
        }

        async function closeLead(id) {
            if (!confirm('Mark this lead as closed?')) return;

            const response = await fetch(\`/admin?action=close-lead&id=\${id}\`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                loadPendingLeads();
                loadStats();
            } else {
                alert('Error: Failed to close lead');
            }
        }

        async function loadBusinesses() {
            // Clear other lists
            document.getElementById('submissions-list').innerHTML = '';
            document.getElementById('leads-list').innerHTML = '';

            const response = await fetch('/admin?action=all-businesses');
            const data = await response.json();

            const list = document.getElementById('businesses-list');
            if (data.count === 0) {
                list.innerHTML = '<p class="text-gray-500">No businesses found</p>';
                return;
            }

            list.innerHTML = \`
                <h3 class="text-lg font-bold mb-4">All Businesses (\${data.count})</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            \${data.businesses.map(biz => \`
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="text-sm font-medium text-gray-900">\${biz.name}</div>
                                        <div class="text-sm text-gray-500"><a href="/business/\${biz.slug}" target="_blank" class="text-blue-600">View Page →</a></div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        \${biz.city}, \${biz.state}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ⭐ \${biz.google_rating.toFixed(1)}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full \${
                                            biz.is_featured ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                        }">
                                            \${biz.is_featured ? '⭐ Featured' : 'Standard'}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onclick="toggleFeatured(\${biz.id}, this)"
                                            class="px-3 py-1 rounded text-white \${
                                                biz.is_featured ? 'bg-gray-600 hover:bg-gray-700' : 'bg-yellow-600 hover:bg-yellow-700'
                                            }">
                                            \${biz.is_featured ? 'Unfeature' : 'Feature'}
                                        </button>
                                    </td>
                                </tr>
                            \`).join('')}
                        </tbody>
                    </table>
                </div>
            \`;
        }

        async function toggleFeatured(id, button) {
            const response = await fetch(\`/admin?action=toggle-featured&id=\${id}\`, { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                // Refresh the business list to show updated status
                loadBusinesses();
                loadStats();
            } else {
                alert('Error: Failed to toggle featured status');
            }
        }
    </script>
</body>
</html>
  `;
}
