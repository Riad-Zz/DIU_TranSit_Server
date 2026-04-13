# RouteSync — Backend API Server

This is the backend server that powers the RouteSync transport management platform. It is built with Node.js and Express.js. Think of it as the brain of the entire system — it handles all the important tasks like storing data, checking user permissions, managing bus routes, processing transport card applications, and keeping track of payments.

The backend uses PostgreSQL (a powerful database) to store all information securely. It also uses Firebase Admin SDK to verify that every request comes from a real, logged-in user. This means no one can cheat the system or access data they shouldn't see.

---

## **Tech Stack**

![Node.js](https://skillicons.dev/icons?i=nodejs) ![Express](https://skillicons.dev/icons?i=express) ![Supabase](https://skillicons.dev/icons?i=supabase)  ![PostgreSQL](https://skillicons.dev/icons?i=postgres) ![Firebase](https://skillicons.dev/icons?i=firebase) ![JavaScript](https://skillicons.dev/icons?i=js)

### **Technology Table**

| Layer               | Technology                                      |
| ------------------- | ----------------------------------------------- |
| **Runtime**         | Node.js                                         |
| **Framework**       | Express.js                                      |
| **Database**        | PostgreSQL (via `postgres.js`)                  |
| **Security/Auth**   | Firebase Admin SDK, JWT Verification            |
| **Middleware**      | CORS, Express.json(), Custom Token Validator    |

---

## **Database Architecture (How Data is Organized)**

The backend uses a relational database, which means data is stored in different tables that connect to each other. Think of it like filing cabinets — each cabinet (table) holds one type of information, and they are linked together with ID numbers.

Here are the four main tables:

### 1. **`users` Table — The Main Identity Cabinet**
- Stores basic information for every person who signs up
- Contains: `name` (full name), `email` (login email), and `role` (what type of user they are)
- **Role can be:** `admin` (full control), `student` (verified student), or `non-student` (registered but not verified)
- Every user gets a unique ID number

### 2. **`student` Table — University Information**
- Connected to the `users` table using `user_id` (like linking two files together)
- Stores university-specific information that regular users don't have
- Contains: `student_id` (university ID number), `department` (e.g., Computer Science), `edu_mail` (university email), and `card_status` (does this student have an active transport card?)
- A person can only have a student record if they have verified their university status

### 3. **`card_apply` Table — Transport Card Applications**
- Connected to the `student` table using `student_id`
- This table keeps a record every time a student applies for a transport card
- Contains: `paid_amount` (how much money they paid), application date
- This helps track who has applied and whether an admin has approved them

### 4. **`bus_routes` Table — All Bus Information**
- This is a standalone table (not directly connected to users)
- Stores every bus route in the system
- Contains: origin (starting point), destination (ending point), timings (when the bus runs), price (how much it costs), and `stops_str` (a comma-separated list of all stops in between)
- Example of `stops_str`: `"Main Gate,Library,Science Building,North Hall"`

---
## **Database Tables with Connections**

```sql
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│       users         │  │      student        │  │     card_apply      │  │     bus_routes      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ 🔑 id (PK)          │  │ 🔑 id (PK)          │  │ 🔑 id (PK)         │  │ 🔑 id (PK)         │
│    name             │  │ 🔗 user_id (FK)     │  │ 🔗 student_id (FK) │   │    origin          │
│    email            │  │    student_id       │  │    paid_amount      │  │    destination      │
│    role             │  │    department       │  │    apply_date       │  │    timings          │
│                     │  │    edu_mail         │  │                     │  │    price            │
│                     │  │    card_status      │  │                     │  │    stops_str        │
└──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘  └─────────────────────┘
           │                        │                        │_______
           │                   ____ |                                |
           ▼  (1-to-1)         ▼                   (One-to-Many)     |     
     users.id ──────► student.user_id     student.id ──────► card_apply.student_id     bus_routes (Standalone)

```
## REAL EXAMPLE WITH DATA:
```
    users table:
    ┌─────┬──────────┬─────────────────────┬─────────┐
    │ id  │   name   │       email         │  role   │
    ├─────┼──────────┼─────────────────────┼─────────┤
    │ 101 │ John     │ john@university.edu │ student │
    └─────┴──────────┴─────────────────────┴─────────┘
           │
           │ (One-to-One)
           ▼
    student table:
    ┌────┬─────────┬────────────┬──────────────┬────────────┐
    │ id │ user_id │ student_id │ department   │ card_status│
    ├────┼─────────┼────────────┼──────────────┼────────────┤
    │ 5  │ 101     │ CS2024001  │ CS           │ pending    │
    └────┴─────────┴────────────┴──────────────┴────────────┘
           │
           │ (One-to-Many)
           ▼
    card_apply table:
    ┌────┬────────────┬─────────────┬────────────────────┬
    │ id │ student_id │ paid_amount │ apply_date         │ 
    ├────┼────────────┼─────────────┼────────────────────┼
    │ 1  │ 5          │ 50.00       │ 2024-01-15         │
    │ 2  │ 5          │ 50.00       │ 2024-02-20         │ 
    └────┴────────────┴─────────────┴────────────────────┴
```
## **Core System Features (What the Backend Actually Does)**

### 🔐 **Secure Authentication Flow — Keeping Bad Guys Out**

Every time the frontend (React app) wants to get or send data, it must prove that the user is logged in. Here's how it works:

1. When a user logs in through the frontend, Firebase gives them a special **token** (like a digital ID card)
2. The frontend attaches this token to every request it sends to the backend
3. The backend has a special function called `fireBaseTokenVarify` (like a security guard at a gate)
4. This security guard:
   - Checks if the token exists
   - Uses Firebase Admin SDK to verify the token is real and not expired
   - Extracts the user's email from the token
   - Attaches the email to the request so other parts of the code know who is asking
5. If the token is missing or fake, the backend immediately returns a **401 Unauthorized** error
6. The user sees "Please log in again" or is redirected to the login page

**Why this matters:** Without this, anyone could pretend to be an admin and delete bus routes or approve fake card applications. This security layer protects the entire system.

### 🚌 **Dynamic Schedule Logic — Smart Bus Search**

When a student searches for a bus from "Main Gate" to "Science Building", the backend doesn't just look for those words. It does something much smarter:

**Step 1: Find Matching Buses**
- The backend queries the database using PostgreSQL's `ILIKE` operator (which ignores uppercase/lowercase differences)
- It looks for any bus route that contains both the "From" location and the "To" location somewhere in its stops list

**Step 2: Check Direction (This is the Smart Part)**
- Just because a bus passes through both stops doesn't mean it goes in the right direction
- Example: A bus might go: "North Hall → Library → Main Gate → Science Building"
- If you want to go from "Main Gate" to "Science Building", that's fine (Main Gate comes before Science Building)
- But if you want to go from "Science Building" to "Main Gate", the bus would be going backward
- The backend checks the **index position** (order number) of each stop in the `stops_str`
- It makes sure the "From" stop index is **less than** (comes before) the "To" stop index
- If the "From" comes after the "To", that bus is not shown in results

**Why this matters:** This prevents showing students buses that would take them in the wrong direction, even if the bus passes through both locations.

### 💳 **Transactional Card Processing — One Request, Many Updates**

When a student applies for a transport card, it's not as simple as just saving one piece of information. The backend must update multiple tables in a single action. Here's what happens in one API call:

**What the backend does automatically:**

1. **Creates a payment record** in the `card_apply` table
   - Records how much the student paid
   - Records the date and time of application
   - Sets initial status to `pending`

2. **Updates the student's information** in the `student` table
   - Stores their current semester (e.g., "Fall 2024")
   - Updates their department if changed
   - Sets their `card_status` to `pending` (waiting for admin approval)

3. **Syncs the user's name** in the `users` table
   - Ensures the full name is correct everywhere
   - This prevents display issues on the frontend

**Why this matters:** If any of these steps fail (e.g., database connection drops), the entire request fails and nothing is saved. This is called a "transaction" — all or nothing. This prevents partial data (like a payment record with no student attached) from corrupting the system.

---

## **API Endpoints Overview (What URLs Do What)**

### **Authentication & User Profiles**

| Method | Route | Description | Who Can Use |
| :--- | :--- | :--- | :---: |
| `GET` | `/users` | Get all registered users (or search by email) | Only logged-in users |
| `POST` | `/users` | Register a new user in the database | Anyone (signup) |
| `POST` | `/student` | Add university information to a user account | Logged-in users |
| `GET` | `/studentinfo` | Get combined user info + student info (like a merged report) | Logged-in users |

### **Fleet Logistics & Bus Scheduling**

| Method | Route | Description | Who Can Use |
| :--- | :--- | :--- | :---: |
| `GET` | `/schedule` | Search for buses by location and day | Anyone (even without login) |
| `GET` | `/manage-busses` | Get all buses (for admin dashboard) | Only admins |
| `GET` | `/busses/:id` | Get details of one specific bus by its ID | Only logged-in users |
| `POST` | `/bus-routes` | Add a new bus to the system | Only admins |
| `PATCH` | `/bus-routes/:id` | Update an existing bus route | Only admins |
| `DELETE` | `/bus-routes/:id` | Remove a bus route completely | Only admins |

### **Card Processing & Finance**

| Method | Route | Description | Who Can Use |
| :--- | :--- | :--- | :---: |
| `POST` | `/apply-transport-card` | Submit an application for a transport card | Only verified students |
| `GET` | `/card-applications` | View all card applications (pending and active) | Only admins |
| `PATCH` | `/card-status/:id` | Approve or reject a student's card | Only admins |
| `GET` | `/payments` | View all payment transaction history | Only admins |
| `GET` | `/payment-stats` | Get total revenue (dashboard numbers) | Only admins |

### **Admin Access Control (User Management)**

| Method | Route | Description | Who Can Use |
| :--- | :--- | :--- | :---: |
| `GET` | `/admin/students` | Get all students with their complete information (combines multiple tables) | Only admins |
| `PATCH` | `/admin/users/promote/:id` | Change a regular user into an admin | Only admins |
| `PATCH` | `/admin/users/revoke/:id` | Remove admin access from someone | Only admins |
| `DELETE` | `/admin/users/:id` | Permanently delete a user and all their student records | Only admins |

---

# Backend Setup Guide

This guide explains how to install, configure, and run the backend server locally, along with an overview of required dependencies.

## Installation & Setup

### Step 1: Clone the Repository

Download the backend source code and navigate into the project directory:

```bash id="k3m9zq"
git clone https://github.com/Riad-Zz/DIU_TranSit_Server.git
cd DIU_TranSit_Server
```


### Step 2: Install Dependencies

Install all required packages:

```bash id="q8r1vx"
npm install
```

This will download all necessary libraries such as Express, PostgreSQL client, Firebase Admin SDK, and others required for the backend to function.

### Step 3: Environment Configuration

Create a `.env` file in the root directory and add the following:

```env id="w2c7jd"
PORT=3000
DATABASE_URL=postgres://user:password@host:port/dbname
FIREBASE_KEY=your_base64_encoded_service_account_json
```

#### How to get `FIREBASE_KEY`

1. Go to Firebase Console
2. Open **Project Settings → Service Accounts**
3. Click **Generate New Private Key**
4. Download the JSON file
5. Convert the JSON file into a Base64 string
6. Paste the encoded string as the value of `FIREBASE_KEY`

**Why Base64?**
The Firebase service account file contains line breaks and special characters. Encoding it ensures it can be safely stored in a single-line environment variable.

### Step 4: Start the Server

#### Development mode (auto-restart)

```bash id="t5n2yl"
npx nodemon index.js
```

#### Production mode

```bash id="h7x4pa"
node index.js
```

If configured correctly, the server will start with:

```id="s9u1df"
Server running on port 3000
```

## Dependencies

### Core Dependencies

```json id="p4k8re"
{
  "cors": "^2.8.5",
  "dotenv": "^16.x.x",
  "express": "^4.x.x",
  "firebase-admin": "^12.x.x",
  "postgres": "^3.x.x"
}
```

#### Description

* **cors**
  Enables communication between frontend and backend across different origins

* **dotenv**
  Loads environment variables from `.env`

* **express**
  Handles routing and server logic

* **firebase-admin**
  Verifies authentication tokens and interacts with Firebase services

* **postgres**
  Connects to PostgreSQL and executes database queries

### Development Dependency

```json id="m6v2ox"
{
  "nodemon": "^3.x.x"
}
```

#### Description

* **nodemon**
  Automatically restarts the server during development when file changes are detected
