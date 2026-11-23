
/* TECHNESTUS FARM ERP
   Supabase Authentication and Startup
*/

let supabaseClient = null;
let sessionUser = null;
let userProfile = null;

const MODULES = [
  "dashboard",
  "incubators",
  "eggs",
  "hatches",
  "brooding",
  "birds",
  "mortality",
  "customers",
  "sales",
  "expenses",
  "investors",
  "investments",
  "repayments",
  "invoices",
  "receipts",
  "reports",
  "accounting",
  "journals",
  "payables",
  "analytics",
  "settings",
  "users"
];

function cacheKey() {
  return "technestus_erp_v2";
}

function canView(module) {
  if (!sessionUser) return false;

  if (userProfile?.role === "super_admin") {
    return true;
  }

  return (
    userProfile?.permissions?.includes(module) === true
  );
}

function canWrite(module) {
  if (!sessionUser) return false;

  if (userProfile?.role === "super_admin") {
    return true;
  }

  if (module === "users") return false;

  return (
    userProfile?.write_permissions?.includes(module) === true
  );
}

function showAuthError(message) {
  const element = document.getElementById("authError");

  if (element) {
    element.textContent = message || "";
  }
}

function setCloudStatus(message) {
  const element = document.getElementById("cloudStatus");

  if (element) {
    element.textContent = message;
  }
}

function showLogin() {
  const gate = document.getElementById("authGate");

  if (gate) {
    gate.style.display = "flex";
  }
}

function hideLogin() {
  const gate = document.getElementById("authGate");

  if (gate) {
    gate.style.display = "none";
  }
}

async function init() {
  try {
    const config = window.TECHNESTUS_CONFIG;

    if (!config?.supabaseUrl || !config?.supabaseKey) {
      throw new Error(
        "Supabase URL or publishable key is missing."
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase JavaScript library is not loaded."
      );
    }

    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseKey
    );

    setCloudStatus("Supabase configured");

    const { data, error } =
      await supabaseClient.auth.getUser();

    if (error || !data?.user) {
      showLogin();
      return;
    }

    await activateUser(data.user);

  } catch (error) {
    console.error("ERP startup error:", error);

    setCloudStatus("Connection error");
    showAuthError(error.message);
    showLogin();
  }
}

async function login(event) {
  event.preventDefault();

  showAuthError("");

  if (!supabaseClient) {
    showAuthError(
      "Supabase is not connected. Check cloud-config.js."
    );
    return;
  }

  const form = event.target;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;

  const button = form.querySelector(
    'button[type="submit"]'
  );

  button.disabled = true;
  button.textContent = "Signing in...";

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data.user) {
      throw new Error("Login was not successful.");
    }

    await activateUser(data.user);

  } catch (error) {
    console.error("Login error:", error);
    showAuthError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
}

async function activateUser(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, role, permissions, write_permissions, active")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    await supabaseClient.auth.signOut();

    throw new Error(
      "Your account has no ERP profile. " +
      "Ask the Super Admin to configure it."
    );
  }

  if (!data.active) {
    await supabaseClient.auth.signOut();

    throw new Error("Your account is disabled.");
  }

  userProfile = data;
  sessionUser = user;

  hideLogin();
  setCloudStatus("Connected as " + data.role);

  if (typeof render === "function") {
    render();
  }

  await testCloudLoading();
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  sessionUser = null;
  userProfile = null;

  showLogin();
  setCloudStatus("Signed out");
}

async function changePassword() {
  if (!supabaseClient || !sessionUser) return;

  const password = prompt(
    "Enter your new password (at least 12 characters):"
  );

  if (!password) return;

  if (password.length < 12) {
    alert("Password must contain at least 12 characters.");
    return;
  }

  const { error } =
    await supabaseClient.auth.updateUser({
      password
    });

  if (error) {
    alert(error.message);
  } else {
    alert("Password updated successfully.");
  }
}

function usersPage(element) {
  if (userProfile?.role !== "super_admin") {
    element.textContent = "Access denied.";
    return;
  }

  element.innerHTML = `
    <div class="head">
      <h2>Users & Permissions</h2>
    </div>

    <div class="panel">
      <h3>Employee Management</h3>

      <p>
        Super Admin access is active.
      </p>

      <p>
        Secure employee account creation requires
        a deployed Supabase Edge Function.
        Do not create employee accounts directly
        using the public browser key.
      </p>
    </div>
  `;
}

function queueDiff() {
  // Cloud record synchronization is not enabled.
  // Existing farm records remain in browser storage.
}

function discardPending() {
  alert("No cloud synchronization queue is configured.");
}

async function testCloudLoading() {
  if (!supabaseClient || !sessionUser) {
    console.warn("Please sign in first.");
    return;
  }

  setCloudStatus("Checking cloud records...");

  const { data, error, count } = await supabaseClient
    .from("app_records")
    .select("module, record_id, version, updated_at", {
      count: "exact"
    })
    .eq("deleted", false)
    .order("updated_at", { ascending: false })
    .range(0, 99);

  if (error) {
    console.error("Cloud loading failed:", error);
    setCloudStatus("Cloud read failed");
    return;
  }

  console.log("Cloud record count:", count);
  console.table(data);

  setCloudStatus("Cloud connected · " + count + " records");
}
