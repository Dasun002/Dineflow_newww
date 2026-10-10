import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, runTransaction, writeBatch,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase/config';
import { RID, findTables, todayStr } from '../utils';

const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const listen = (q, cb) => onSnapshot(q, (s) => cb(list(s)), (e) => console.warn('Firestore:', e.message));

// Fetch a user profile (name + mobile) – used by staff call screen
export async function getUserProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}

// ---------- customer dining preferences ----------
const PREFS_KEY = (uid) => `@user_prefs_${uid}`;
const prefListeners = {};

const notifyPrefListeners = (uid, items) => {
  if (prefListeners[uid]) {
    prefListeners[uid].forEach((fn) => {
      try { fn(items); } catch (_) {}
    });
  }
};

export const watchUserPreferences = (uid, cb) => {
  if (!uid) {
    cb([]);
    return () => {};
  }

  if (!prefListeners[uid]) prefListeners[uid] = new Set();
  prefListeners[uid].add(cb);

  // Immediate load from local storage
  AsyncStorage.getItem(PREFS_KEY(uid))
    .then((raw) => {
      if (raw) {
        try { cb(JSON.parse(raw)); } catch (_) {}
      }
    })
    .catch(() => {});

  let isUnmounted = false;
  let unsubFirestore = () => {};

  try {
    unsubFirestore = onSnapshot(
      collection(db, 'users', uid, 'preferences'),
      (snap) => {
        if (isUnmounted) return;
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
        AsyncStorage.setItem(PREFS_KEY(uid), JSON.stringify(items)).catch(() => {});
        cb(items);
      },
      (e) => {
        console.warn('Preferences Firestore listener notice:', e.message);
        // Fallback to local storage if Firestore remote rules are pending deployment
        AsyncStorage.getItem(PREFS_KEY(uid))
          .then((raw) => {
            if (isUnmounted) return;
            const items = raw ? JSON.parse(raw) : [];
            cb(items);
          })
          .catch(() => {
            if (!isUnmounted) cb([]);
          });
      }
    );
  } catch (err) {
    AsyncStorage.getItem(PREFS_KEY(uid))
      .then((raw) => cb(raw ? JSON.parse(raw) : []))
      .catch(() => cb([]));
  }

  return () => {
    isUnmounted = true;
    if (prefListeners[uid]) prefListeners[uid].delete(cb);
    if (typeof unsubFirestore === 'function') unsubFirestore();
  };
};

export async function addUserPreference(uid, { category, title, notes }) {
  if (!uid) throw new Error('User must be signed in to save preferences.');
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) throw new Error('Preference title is required.');
  const data = {
    category: category || 'Dietary',
    title: cleanTitle,
    notes: (notes || '').trim(),
    createdMs: Date.now(),
    updatedMs: Date.now(),
  };

  try {
    const ref = await addDoc(collection(db, 'users', uid, 'preferences'), data);
    const item = { id: ref.id, ...data };
    // update cache
    const raw = await AsyncStorage.getItem(PREFS_KEY(uid)).catch(() => null);
    const items = raw ? JSON.parse(raw) : [];
    const next = [item, ...items.filter((i) => i.id !== item.id)];
    await AsyncStorage.setItem(PREFS_KEY(uid), JSON.stringify(next)).catch(() => {});
    notifyPrefListeners(uid, next);
    return item;
  } catch (err) {
    console.warn('Firestore addDoc fallback to storage:', err.message);
    const id = 'pref_' + Date.now();
    const item = { id, ...data };
    const raw = await AsyncStorage.getItem(PREFS_KEY(uid)).catch(() => null);
    const items = raw ? JSON.parse(raw) : [];
    const next = [item, ...items];
    await AsyncStorage.setItem(PREFS_KEY(uid), JSON.stringify(next));
    notifyPrefListeners(uid, next);
    return item;
  }
}

export async function updateUserPreference(uid, prefId, { category, title, notes }) {
  if (!uid) throw new Error('User must be signed in.');
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) throw new Error('Preference title is required.');
  const data = {
    category: category || 'Dietary',
    title: cleanTitle,
    notes: (notes || '').trim(),
    updatedMs: Date.now(),
  };

  try {
    const ref = doc(db, 'users', uid, 'preferences', prefId);
    await updateDoc(ref, data);
  } catch (err) {
    console.warn('Firestore updateDoc fallback to storage:', err.message);
  }

  // update local cache & notify
  const raw = await AsyncStorage.getItem(PREFS_KEY(uid)).catch(() => null);
  const items = raw ? JSON.parse(raw) : [];
  const next = items.map((i) => (i.id === prefId ? { ...i, ...data } : i));
  await AsyncStorage.setItem(PREFS_KEY(uid), JSON.stringify(next)).catch(() => {});
  notifyPrefListeners(uid, next);
}

export async function deleteUserPreference(uid, prefId) {
  if (!uid || !prefId) throw new Error('Invalid preference reference.');
  try {
    const ref = doc(db, 'users', uid, 'preferences', prefId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore deleteDoc fallback to storage:', err.message);
  }

  // update local cache & notify
  const raw = await AsyncStorage.getItem(PREFS_KEY(uid)).catch(() => null);
  const items = raw ? JSON.parse(raw) : [];
  const next = items.filter((i) => i.id !== prefId);
  await AsyncStorage.setItem(PREFS_KEY(uid), JSON.stringify(next)).catch(() => {});
  notifyPrefListeners(uid, next);
}

// ---------- realtime watchers ----------
export const watchRestaurant = (cb) =>
  onSnapshot(doc(db, 'restaurants', RID), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), (e) => console.warn(e.message));

export const watchTables = (cb) =>
  listen(query(collection(db, 'tables'), where('restaurantId', '==', RID)), (l) =>
    cb(l.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
  );

export const watchReservations = (cb) =>
  listen(query(collection(db, 'reservations'), where('restaurantId', '==', RID)), (l) =>
    cb(l.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)))
  );

export const watchQueueAll = (cb) =>
  listen(query(collection(db, 'queue'), where('restaurantId', '==', RID)), cb);

// active line only (waiting + called), oldest first
export const watchQueue = (cb) =>
  watchQueueAll((l) => cb(l.filter((x) => x.status === 'waiting' || x.status === 'called').sort((a, b) => a.createdMs - b.createdMs)));

// ---------- reservations ----------
export async function createReservation({ uid, name, party, date, time }) {
  const [tables, reservations] = await Promise.all([
    getDocs(query(collection(db, 'tables'), where('restaurantId', '==', RID))).then(list),
    getDocs(query(collection(db, 'reservations'), where('restaurantId', '==', RID))).then(list),
  ]);
  const free = findTables({ tables, reservations, date, time, party });
  if (!free.length) throw new Error('That slot was just taken. Please pick another time.');
  const data = {
    restaurantId: RID, userId: uid, name, partySize: party, date, time, status: 'confirmed',
    tableId: free[0].id, tableName: free[0].name,
    bookingId: '#HB-' + Math.floor(10000 + Math.random() * 89999), createdMs: Date.now(),
  };
  const ref = await addDoc(collection(db, 'reservations'), data);
  return { id: ref.id, ...data };
}

export async function modifyReservation(id, { party, date, time }) {
  const [tables, reservations] = await Promise.all([
    getDocs(query(collection(db, 'tables'), where('restaurantId', '==', RID))).then(list),
    getDocs(query(collection(db, 'reservations'), where('restaurantId', '==', RID))).then(list),
  ]);
  const free = findTables({ tables, reservations, date, time, party, excludeId: id });
  if (!free.length) throw new Error('No table is free at that time. Try another slot.');
  await updateDoc(doc(db, 'reservations', id), { partySize: party, date, time, tableId: free[0].id, tableName: free[0].name });
}

export const setReservationStatus = (id, status) => updateDoc(doc(db, 'reservations', id), { status });

// ---------- virtual queue ----------
export async function joinQueue({ uid, name, party }) {
  const counter = doc(db, 'meta', 'queueCounter');
  const num = await runTransaction(db, async (tx) => {
    const s = await tx.get(counter);
    const n = (s.exists() ? s.data().n : 100) + 1;
    tx.set(counter, { n });
    return n;
  });
  const data = {
    restaurantId: RID, userId: uid, name, partySize: party, ticket: 'A' + String(num).padStart(3, '0'),
    status: 'waiting', createdMs: Date.now(), calledMs: null, arrived: false, tableId: null,
  };
  const ref = await addDoc(collection(db, 'queue'), data);
  return { id: ref.id, ...data };
}
export const updateQueue = (id, patch) => updateDoc(doc(db, 'queue', id), patch);
export const callEntry = (id) => updateQueue(id, { status: 'called', calledMs: Date.now() });
export const noShowEntry = (id) => updateQueue(id, { status: 'no_show' });

// ---------- staff: tables / seating ----------
export const setTableStatus = (id, status) => updateDoc(doc(db, 'tables', id), { status });

export async function createTable({ name, area, capacity, status }) {
  const cleanName = (name || '').trim();
  const cleanArea = (area || '').trim();
  const cap = Number(capacity);

  if (!cleanName) throw new Error('Table name is required (e.g., T10).');
  if (!cleanArea) throw new Error('Section/Area is required (e.g., Patio Section).');
  if (!cap || isNaN(cap) || cap < 1) throw new Error('Capacity must be a positive number of seats (at least 1).');

  // Check if table name already exists
  const existing = await getDocs(
    query(collection(db, 'tables'), where('restaurantId', '==', RID), where('name', '==', cleanName))
  );
  if (!existing.empty) {
    throw new Error(`A table named "${cleanName}" already exists. Please choose a unique name.`);
  }

  const data = {
    restaurantId: RID,
    name: cleanName,
    area: cleanArea,
    capacity: cap,
    status: status || 'available',
    createdMs: Date.now(),
  };
  const ref = await addDoc(collection(db, 'tables'), data);
  return { id: ref.id, ...data };
}

export async function updateTable(id, { name, area, capacity, status }) {
  const cleanName = (name || '').trim();
  const cleanArea = (area || '').trim();
  const cap = Number(capacity);

  if (!cleanName) throw new Error('Table name is required.');
  if (!cleanArea) throw new Error('Section/Area is required.');
  if (!cap || isNaN(cap) || cap < 1) throw new Error('Capacity must be a positive number of seats.');

  // Check unique name if changed
  const existing = await getDocs(
    query(collection(db, 'tables'), where('restaurantId', '==', RID), where('name', '==', cleanName))
  );
  const conflict = existing.docs.find((d) => d.id !== id);
  if (conflict) {
    throw new Error(`Another table already has the name "${cleanName}".`);
  }

  const patch = {
    name: cleanName,
    area: cleanArea,
    capacity: cap,
    status: status || 'available',
    updatedMs: Date.now(),
  };
  await updateDoc(doc(db, 'tables', id), patch);
}

export async function checkTableSafeToDelete(id) {
  const s = await getDoc(doc(db, 'tables', id));
  if (!s.exists()) return { safe: false, reason: 'Table no longer exists in the system.' };
  const table = s.data();

  // 1. Check if currently marked occupied
  if (table.status === 'occupied') {
    return {
      safe: false,
      reason: `Table "${table.name}" is currently OCCUPIED. Clear or seat the guests elsewhere before deleting.`,
    };
  }

  // 2. Check active or upcoming reservations referencing this table
  const today = todayStr();
  const resvSnap = await getDocs(
    query(collection(db, 'reservations'), where('restaurantId', '==', RID), where('tableId', '==', id))
  );
  const activeResvs = resvSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => (r.status === 'confirmed' && r.date >= today) || r.status === 'seated');

  if (activeResvs.length > 0) {
    const r = activeResvs[0];
    return {
      safe: false,
      reason: `Table "${table.name}" is assigned to active/upcoming reservation ${r.bookingId} (${r.name}, ${r.date} at ${r.time}). Please cancel or reassign this reservation first.`,
    };
  }

  // 3. Check active queue tickets assigned to this table
  const queueSnap = await getDocs(
    query(collection(db, 'queue'), where('restaurantId', '==', RID), where('tableId', '==', id))
  );
  const activeQ = queueSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((q) => q.status === 'called' || q.status === 'seated');

  if (activeQ.length > 0) {
    const q = activeQ[0];
    return {
      safe: false,
      reason: `Table "${table.name}" is currently assigned to queue party ${q.ticket} (${q.name}). Please finish seating or reassign before deleting.`,
    };
  }

  return { safe: true, table };
}

export async function deleteTable(id) {
  const check = await checkTableSafeToDelete(id);
  if (!check.safe) {
    throw new Error(check.reason);
  }
  await deleteDoc(doc(db, 'tables', id));
}

export async function seatEntry({ entryId, tableId, override }) {
  const b = writeBatch(db);
  const patch = { status: 'seated', seatedMs: Date.now(), tableId };
  if (override) patch.override = override; // audit note for double-booking override
  b.update(doc(db, 'queue', entryId), patch);
  b.update(doc(db, 'tables', tableId), { status: 'occupied' });
  await b.commit();
}

// ---------- menu items management & browsing ----------
const MENU_STORAGE_KEY = '@harbor_bistro_menu_items';
const menuListeners = new Set();
const notifyMenuListeners = (items) => {
  menuListeners.forEach((fn) => {
    try { fn(items); } catch (_) {}
  });
};

const getInitialStarterMenu = () =>
  STARTER_MENU_ITEMS.map((item, idx) => ({
    id: `m${idx + 1}`,
    restaurantId: RID,
    ...item,
    createdMs: 1700000000000 + idx * 1000,
    updatedMs: 1700000000000 + idx * 1000,
  }));

export const watchMenuItems = (cb) => {
  menuListeners.add(cb);
  let isUnmounted = false;

  // Initial load from storage / defaults
  AsyncStorage.getItem(MENU_STORAGE_KEY)
    .then((raw) => {
      if (isUnmounted) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cb(parsed);
            return;
          }
        } catch (_) {}
      }
      const starters = getInitialStarterMenu();
      AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(starters)).catch(() => {});
      cb(starters);
    })
    .catch(() => {
      if (!isUnmounted) cb(getInitialStarterMenu());
    });

  let unsubFirestore = () => {};
  try {
    unsubFirestore = onSnapshot(
      query(collection(db, 'menuItems'), where('restaurantId', '==', RID)),
      (snap) => {
        if (isUnmounted) return;
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort(
          (a, b) =>
            (a.category || '').localeCompare(b.category || '') ||
            (a.name || '').localeCompare(b.name || '')
        );
        if (items.length > 0) {
          AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
          cb(items);
        }
      },
      (e) => {
        console.warn('Menu Firestore listener notice:', e.message);
      }
    );
  } catch (_) {}

  return () => {
    isUnmounted = true;
    menuListeners.delete(cb);
    if (typeof unsubFirestore === 'function') unsubFirestore();
  };
};

export async function createMenuItem({ name, description, category, price, isAvailable }) {
  const cleanName = (name || '').trim();
  const cleanCategory = (category || '').trim();
  const numPrice = Number(price);

  if (!cleanName) throw new Error('Dish/Item name is required.');
  if (!cleanCategory) throw new Error('Category is required (e.g., Mains, Appetizers).');
  if (isNaN(numPrice) || numPrice <= 0) throw new Error('Price must be a valid positive number.');

  const data = {
    restaurantId: RID,
    name: cleanName,
    description: (description || '').trim(),
    category: cleanCategory,
    price: Math.round(numPrice * 100) / 100,
    isAvailable: isAvailable !== false,
    isArchived: false,
    createdMs: Date.now(),
    updatedMs: Date.now(),
  };

  let id = 'm_' + Date.now();
  try {
    const ref = await addDoc(collection(db, 'menuItems'), data);
    id = ref.id;
  } catch (err) {
    console.warn('Firestore menu addDoc fallback to storage:', err.message);
  }

  const newItem = { id, ...data };
  const raw = await AsyncStorage.getItem(MENU_STORAGE_KEY).catch(() => null);
  const items = raw ? JSON.parse(raw) : getInitialStarterMenu();
  const next = [newItem, ...items.filter((i) => i.id !== id)];
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyMenuListeners(next);
  return newItem;
}

export async function updateMenuItem(id, { name, description, category, price, isAvailable, isArchived }) {
  const cleanName = (name || '').trim();
  const cleanCategory = (category || '').trim();
  const numPrice = Number(price);

  if (!cleanName) throw new Error('Dish/Item name is required.');
  if (!cleanCategory) throw new Error('Category is required.');
  if (isNaN(numPrice) || numPrice <= 0) throw new Error('Price must be a valid positive number.');

  const patch = {
    name: cleanName,
    description: (description || '').trim(),
    category: cleanCategory,
    price: Math.round(numPrice * 100) / 100,
    isAvailable: isAvailable !== false,
    isArchived: Boolean(isArchived),
    updatedMs: Date.now(),
  };

  try {
    await updateDoc(doc(db, 'menuItems', id), patch);
  } catch (err) {
    console.warn('Firestore updateMenuItem fallback to storage:', err.message);
  }

  const raw = await AsyncStorage.getItem(MENU_STORAGE_KEY).catch(() => null);
  const items = raw ? JSON.parse(raw) : getInitialStarterMenu();
  const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyMenuListeners(next);
}

export async function setMenuItemAvailability(id, isAvailable) {
  try {
    await updateDoc(doc(db, 'menuItems', id), { isAvailable, updatedMs: Date.now() });
  } catch (err) {
    console.warn('Firestore setMenuItemAvailability fallback to storage:', err.message);
  }

  const raw = await AsyncStorage.getItem(MENU_STORAGE_KEY).catch(() => null);
  const items = raw ? JSON.parse(raw) : getInitialStarterMenu();
  const next = items.map((i) => (i.id === id ? { ...i, isAvailable, updatedMs: Date.now() } : i));
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyMenuListeners(next);
}

export async function setMenuItemArchived(id, isArchived) {
  try {
    await updateDoc(doc(db, 'menuItems', id), { isArchived, updatedMs: Date.now() });
  } catch (err) {
    console.warn('Firestore setMenuItemArchived fallback to storage:', err.message);
  }

  const raw = await AsyncStorage.getItem(MENU_STORAGE_KEY).catch(() => null);
  const items = raw ? JSON.parse(raw) : getInitialStarterMenu();
  const next = items.map((i) => (i.id === id ? { ...i, isArchived, updatedMs: Date.now() } : i));
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyMenuListeners(next);
}

export async function deleteMenuItem(id) {
  try {
    await deleteDoc(doc(db, 'menuItems', id));
  } catch (err) {
    console.warn('Firestore deleteMenuItem fallback to storage:', err.message);
  }

  const raw = await AsyncStorage.getItem(MENU_STORAGE_KEY).catch(() => null);
  const items = raw ? JSON.parse(raw) : getInitialStarterMenu();
  const next = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyMenuListeners(next);
}

// ---------- demo data (run once from Staff Dashboard) ----------
export const STARTER_MENU_ITEMS = [
  { name: 'Maine Lobster Bisque', description: 'Velvety lobster broth with fresh Maine lobster meat, sherry, and chive cream', category: 'Appetizers', price: 16.50, isAvailable: true, isArchived: false },
  { name: 'Crispy Calamari', description: 'Tender Monterey squid with sweet chili dip and smoked paprika aioli', category: 'Appetizers', price: 14.00, isAvailable: true, isArchived: false },
  { name: 'Pan-Roasted Chilean Sea Bass', description: 'Wild-caught sea bass with saffron risotto, lemon herb emulsion, and asparagus', category: 'Mains', price: 34.00, isAvailable: true, isArchived: false },
  { name: 'Prime Ribeye Steak (12oz)', description: 'Certified Black Angus ribeye with truffle mashed potatoes and red wine reduction', category: 'Mains', price: 42.00, isAvailable: true, isArchived: false },
  { name: 'Wild Mushroom Truffle Risotto', description: 'Arborio rice with foraged mushrooms, parmesan crisps, and black truffle oil', category: 'Mains', price: 26.00, isAvailable: true, isArchived: false },
  { name: 'Classic Vanilla Creme Brulee', description: 'Madagascar vanilla custard with caramelized sugar crust and fresh berries', category: 'Desserts', price: 11.00, isAvailable: true, isArchived: false },
  { name: 'Valrhona Warm Chocolate Lava Cake', description: 'Decadent molten center served with artisanal pistachio gelato', category: 'Desserts', price: 12.50, isAvailable: true, isArchived: false },
  { name: 'Harbor Sunset Mocktail', description: 'Fresh blood orange, rosemary syrup, and sparkling elderflower tonic', category: 'Beverages', price: 8.50, isAvailable: true, isArchived: false },
];

export async function seedDemoData() {
  const b = writeBatch(db);
  b.set(doc(db, 'restaurants', RID), {
    name: 'Harbor Bistro', cuisine: 'Modern American', area: 'Waterfront District',
    address: '120 Harbor View Dr, Waterfront', phone: '(555) 234-5678', rating: 4.9, reviews: '1.2k',
    open: '17:00', close: '22:00', lastSeating: '21:30', tags: ['Seafood', 'Sunset views', 'Wine list'],
  });
  const defs = [
    ['t1', 'T1', 'Patio Section', 4], ['t2', 'T2', 'Patio Section', 2], ['t3', 'T3', 'Patio Section', 4],
    ['t4', 'T4', 'Main Dining Hall', 6], ['t5', 'T5', 'Main Dining Hall', 4], ['t6', 'T6', 'Main Dining Hall', 4],
    ['t7', 'T7', 'Main Dining Hall', 8], ['t8', 'T8', 'Main Dining Hall', 4], ['t9', 'T9', 'Main Dining Hall', 2],
  ];
  defs.forEach(([id, name, area, capacity]) =>
    b.set(doc(db, 'tables', id), { restaurantId: RID, name, area, capacity, status: 'available' })
  );
  b.set(doc(db, 'meta', 'queueCounter'), { n: 100 });

  // Seed starter menu items with deterministic IDs
  STARTER_MENU_ITEMS.forEach((item, idx) => {
    b.set(doc(db, 'menuItems', `m${idx + 1}`), {
      restaurantId: RID,
      ...item,
      createdMs: Date.now() + idx,
      updatedMs: Date.now() + idx,
    });
  });

  await b.commit();
}
