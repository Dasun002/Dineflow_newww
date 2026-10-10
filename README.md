# DineFlow – Restaurant Table Reservation & Queue App (React Native + Firebase)

IT3060 HCI · Group WE_127. Built from Milestone 01 (requirements FR1–FR10, NFR1–NFR8) and the Milestone 02 high-fidelity prototype with production-ready real-time architecture. Stack: **Expo (React Native)**, **Firebase Auth** (customer email/password, staff/manager shift login), **Cloud Firestore** (real-time listeners everywhere – no manual refresh, NFR2), and **AsyncStorage** resilient local sync.

---

## Screens → Files → Requirements

| Screen | File | Description & Requirements |
|---|---|---|
| **c01 Splash** | `src/screens/customer/Splash.js` | Welcome portal, authentication gateways |
| **c02 Home** | `src/screens/customer/Home.js` | Harbor Bistro overview, live availability, quick actions, Menu link (FR1, FR9) |
| **c03 Restaurant details** | `src/screens/customer/RestaurantDetails.js` | Restaurant profile, dining hours, tags, full menu link (FR1) |
| **c04 Reservation details** | `src/screens/customer/ReservationDetails.js` | Party size, date picker, booking wizard (FR2) |
| **c05 Available slots** | `src/screens/customer/AvailableSlots.js` | Live available time slot discovery (FR2, FR8) |
| **c06 Reservation confirmation** | `src/screens/customer/ReservationConfirmation.js` | Booking code generation, reminder details (FR2, NFR6) |
| **c07 Join virtual queue** | `src/screens/customer/JoinQueue.js` | Party size selection, live line entry (FR3, FR5) |
| **c08 Queue tracker** | `src/screens/customer/QueueTracker.js` | Real-time position in line, estimated wait time (FR3, FR5, NFR2, NFR5) |
| **c09 Table-ready notification** | `src/screens/customer/TableReady.js` | In-app table ready alert, 10-minute check-in timer (FR4, NFR3) |
| **c10 My reservations** | `src/screens/customer/MyReservations.js` | Active & historical bookings (FR6, FR9) |
| **c11 Modify reservation** | `src/screens/customer/ModifyReservation.js` | Reschedule date/time with table availability check (FR6) |
| **c12 Cancel reservation** | `src/screens/customer/CancelReservation.js` | Safe cancellation dialog releasing reserved table (FR6) |
| **c13 Profile & Dining Preferences** | `src/screens/customer/Profile.js` | **[NEW]** Profile information and complete Dining Preferences CRUD (Dietary, Accessibility, Seating, Other) with presets, confirmation, and real-time sync |
| **c14 Menu Browser** | `src/screens/customer/MenuBrowser.js` | **[NEW]** Customer-facing interactive menu with keyword search, category filtering, pricing, and reservation CTAs |
| **s01 Staff login** | `src/screens/staff/StaffLogin.js` | Host and Manager credentialed login |
| **s02 Staff dashboard** | `src/screens/staff/StaffDashboard.js` | Shift overview, quick metrics, management navigation (FR7, NFR8) |
| **s03 Live floor / table map** | `src/screens/staff/FloorMap.js` | Interactive floor plan, table status toggling, quick link to Table Management (FR7, NFR4) |
| **s04 Live queue** | `src/screens/staff/LiveQueue.js` | Queue management, party call triggers, line management (FR5, FR7) |
| **s05 Customer called** | `src/screens/staff/CustomerCalled.js` | Host stand check-in, phone contact shortcut (FR4) |
| **s06 Table assignment** | `src/screens/staff/TableAssignment.js` | Capacity matching, table recommendation engine (FR7) |
| **s07 Double-booking warning** | `src/screens/staff/DoubleBookingWarning.js` | Collision detection & manager override reason log (FR8) |
| **s08 Mark seated** | `src/screens/staff/MarkSeated.js` | Table occupancy confirmation & queue completion (FR7) |
| **s09 Table Management** | `src/screens/staff/TableManagement.js` | **[NEW]** Complete restaurant table CRUD, area breakdown, capacity editing, and safe deletion checks preventing removal of occupied/booked tables |
| **s10 Menu Management** | `src/screens/staff/MenuManagement.js` | **[NEW]** Staff menu CRUD, price updates, live availability toggling (In Stock vs Sold Out / 86'd), and archiving/restoration |
| **m01 Manager analytics** | `src/screens/staff/ManagerAnalytics.js` | Real-time utilization, peak demand hours, no-show rate (FR10) |
| **Staff Hub** | `src/screens/staff/StaffHub.js` | Shift reservations, account details, shortcuts to Table and Menu management (FR7) |

---

## Additional CRUD Features Implemented

### 1. Customer Dining Preferences
- **Interface**: Located on the customer **Profile** tab (`src/screens/customer/Profile.js`).
- **Features**:
  - **Create**: Add individual dining preferences under predefined categories (**Dietary**, **Accessibility**, **Seating**, or **Other**).
  - **Quick Suggestions**: Convenient one-tap suggestion chips for common needs:
    - *Dietary*: Nut Allergy, Gluten-Free, Vegetarian / Vegan, Shellfish Allergy, Dairy-Free
    - *Accessibility*: Wheelchair Accessible, Step-Free Entrance, High Chair Required
    - *Seating*: Quiet Booth, Window View, Outdoor Patio, Away from Kitchen
  - **Read**: Live real-time card list showing category tag, preference title, notes, and action buttons.
  - **Update**: Tap the edit pencil icon to modify category, requirement title, or add specific notes in an inline form.
  - **Delete**: Tap the trash icon with an explicit **Confirmation Dialog** ("Are you sure you want to delete '[Title]'?") before deletion.
  - **UI States**: Handles loading (spinner), empty state with helpful prompt, validation warnings, and success feedback callouts.
- **Persistence**: Persisted under `users/{uid}/preferences/{prefId}` in Firestore with real-time listeners and resilient local storage sync.
- **Security Rules**: Enforces that customers can read and write only their own preferences (`request.auth.uid == uid`).

---

### 2. Staff Table Management
- **Interface**: Accessible from **Staff Dashboard**, **Floor Map** (header link), and **Staff Hub** (`src/screens/staff/TableManagement.js`).
- **Features**:
  - **Create Table**: Add tables with customizable **Table Name/Number** (e.g. `T10`, `Bar 1`), **Dining Area** (`Main Dining Hall`, `Patio Section`, `Bar Area`, `Private Dining`), **Capacity** (1–20 guests), and initial status.
  - **Read / Filter**: Real-time summary statistics (Total Tables, Available, Occupied) and area filter chips (`All`, `Main Dining Hall`, `Patio Section`, `Bar Area`, `Private Dining`).
  - **Update Table**: Tap the pencil icon to modify name, dining area, seating capacity, or live status.
  - **Safe Deletion Checks**: Prevents accidental or disruptive deletion:
    1. **Occupied check**: Blocks deletion if table is currently marked as `occupied`.
    2. **Active Reservation check**: Queries Firestore to verify if table is assigned to an upcoming or active confirmed booking, displaying the specific booking reference and guest name.
    3. **Active Queue check**: Verifies table is not assigned to a called or waiting queue party.
  - **Confirmation Dialog**: When deletion is safe, presents an explicit confirmation dialog before removing the table document.
- **Persistence**: Stored under `tables/{id}` in Firestore.
- **Security Rules**: Signed-in users can read table layouts; only authenticated `staff` or `manager` users can create, edit, or delete tables.

---

### 3. Restaurant Menu Management & Browsing
- **Staff Interface**: `src/screens/staff/MenuManagement.js` (linked from Staff Dashboard and Staff Hub).
  - **Create Dish**: Add dishes with **Name**, **Category** (`Appetizers`, `Mains`, `Desserts`, `Beverages`, `Specials`), positive decimal **Price** ($ USD), and **Description / Ingredients**.
  - **Real-Time Dish Metrics**: Live counters for Total Dishes, Available, Sold Out (86'd), and Archived.
  - **Availability Toggle**: One-tap toggle between **In Stock** and **Sold Out / 86'd**. Sold out items are visually flagged to staff and marked on customer menus.
  - **Archiving & Restoring**: Archive items without deleting their historical record. Archived items are automatically hidden from the customer-facing menu.
  - **Edit & Safe Delete**: Full inline editing of dish details and permanent deletion with confirmation.
  - **Starter Menu Seeder**: One-tap starter menu initializer with 8 signature Harbor Bistro dishes.
- **Customer Interface**: `src/screens/customer/MenuBrowser.js` (accessible via "Browse Food Menu" on Home and Restaurant Details).
  - **Keyword Search**: Instant real-time filtering across dish names and ingredient descriptions.
  - **Category Tabs**: Filter by `All`, `Appetizers`, `Mains`, `Desserts`, `Beverages`, or `Specials`.
  - **Live Availability**: Only active (non-archived) items are displayed. Sold out items are clearly labelled so diners have up-to-date information before booking.
  - **Booking Integration**: Direct action buttons at the bottom to jump straight into **Reserve Table** or **Join Queue**.
- **Persistence**: Stored under `menuItems/{id}` in Firestore.
- **Security Rules**: All signed-in diners can read dishes; only `staff` or `manager` users can create, update, toggle availability, archive, or delete dishes.

---

## Firestore Data Model

- `users/{uid}` – `{ name, email, mobile, role: 'customer' | 'staff' | 'manager' }`
- `users/{uid}/preferences/{prefId}` – `{ category, title, notes, createdMs, updatedMs }`
- `restaurants/harbor-bistro` – Restaurant profile & hours
- `tables/{id}` – `{ restaurantId, name, area, capacity, status: 'available' | 'occupied' }`
- `menuItems/{id}` – `{ restaurantId, name, category, price, description, isAvailable, isArchived, createdMs, updatedMs }`
- `reservations/{id}` – `{ userId, name, partySize, date, time, status: 'confirmed' | 'seated' | 'cancelled' | 'no_show', tableId, tableName, bookingId }`
- `queue/{id}` – `{ userId, name, partySize, ticket, status: 'waiting' | 'called' | 'seated' | 'no_show' | 'left', createdMs, calledMs, seatedMs, arrived, override? }`
- `meta/queueCounter` – Monotonic ticket counter

---

## Security Rules Deployment

The updated security rules are provided in `firestore.rules`:
1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Open your project (`dineflow-9a2d0`).
3. Navigate to **Firestore Database** → **Rules** tab.
4. Copy the entire content of `firestore.rules` and paste it into the editor.
5. Click **Publish**.

*Note: The application includes a resilient client layer that functions seamlessly both before and after remote rule deployment.*

---

## Step-by-Step Demo Walkthrough

### Feature 1: Customer Dining Preferences
1. **Launch the App** and sign in as a customer (or register a new account on the Welcome screen).
2. Tap the **Profile** tab in the bottom navigation.
3. Observe the **Dining Preferences** section (initially shows the empty state with a call-to-action).
4. Tap **+ Add Your First Preference** (or **+ Add Preference**).
5. Choose a category (e.g. `Dietary`), tap a quick suggestion (e.g. `+ Nut Allergy`), and tap **Save Preference**.
6. View the newly created preference card in the list with category badge and title.
7. Tap the **Pencil icon** to edit the preference: enter notes (e.g. *"Strictly peanut & cashew free table"*) and tap **Update**.
8. Tap the **Trash icon**: observe the confirmation alert (*"Are you sure you want to delete..."*).
9. Confirm deletion and verify the preference is removed and the list returns to the empty state.

### Feature 2: Staff Table Management
1. From the Splash screen or by logging out from Profile, tap **Restaurant staff? Staff Login**.
2. Log in with staff credentials (e.g., `gayanuka@gmail.com` or manager account).
3. From the **Staff Dashboard** or **Staff Hub**, tap **Manage Restaurant Tables** (or tap **Manage Tables** on the **Floor Map**).
4. Observe the summary counters: **Total Tables**, **Available**, **Occupied**.
5. Tap **+ Add Table**: enter Name `T10`, Area `Bar Area`, Capacity `4`, and tap **Create Table**.
6. Filter by `Bar Area` to verify the table appears in the filtered list.
7. Tap the **Pencil icon** on `T10` to edit capacity or area, then save.
8. Attempt to delete an occupied table (e.g. `T1`): observe that deletion is **blocked** with an informative alert explaining the table is occupied.
9. Delete `T10`: observe that safety checks pass, confirm the deletion dialog, and verify `T10` is removed.

### Feature 3: Restaurant Menu Management & Browsing
1. **Staff Portal**: In Staff Hub or Dashboard, tap **Manage Restaurant Menu**.
2. View dishes with category chips (`Appetizers`, `Mains`, `Desserts`, etc.) and status tabs (`All`, `Active`, `Sold Out`, `Archived`).
3. Tap **+ Add Menu Item**: enter Name `Crispy Duck Confit`, Category `Mains`, Price `29.50`, Description `Slow-cooked duck leg with cherry port reduction`, and tap **Create Item**.
4. Tap **Mark Sold Out** on an item: verify its badge changes to `SOLD OUT` immediately.
5. Tap **Archive**: confirm the alert and verify the item moves to the `Archived` tab.
6. **Customer Portal**: Log out of staff and log in as a customer.
7. On the **Home** screen (or **Restaurant Details**), tap **Browse Food Menu**.
8. Observe the clean customer browsing screen displaying only active items.
9. Filter by category (e.g. `Desserts`) and type in the search bar (e.g. `Lava`): verify real-time search filtering.
10. Tap **Reserve Table** or **Join Queue** at the bottom to transition seamlessly into the booking flow.

---

## Known Limitations & Design Decisions
- Single restaurant demo scope (*Harbor Bistro*).
- Staff and manager accounts are created with credentials in Firebase Auth and given role documents in Firestore (`users/{uid}` with `{ role: 'staff' | 'manager' }`).
- Double-booking protection (FR8) preserves ±90 minute party size matching windows.
- Resilient local caching ensures zero downtime or blank states even if remote Firebase rules take time to deploy.
