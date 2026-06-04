# MyShopee - Local Setup & Configuration Guide

Follow these steps to run MyShopee on your local development machine.

---

## 📋 Prerequisites

Ensure you have the following installed:
* **Node.js** (v18.x or higher)
* **npm** (v9.x or higher)
* A **Neon PostgreSQL** database (or a local PostgreSQL instance)

---

## ⚙️ Step 1: Environment Configuration

We have prepared `.env.example` configurations. You need to verify that your active `.env` files contain the correct credentials.

### Backend Config (`backend/.env`)
Create a file named `.env` in the `backend/` directory with the following variables:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://neondb_owner:npg_Ns01oQvrTMSt@ep-gentle-darkness-aov8xmg7-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
CLIENT_URL=http://localhost:5173

# Stripe Settings (Replace with actual secrets for live testing)
STRIPE_SECRET_KEY=sk_test_placeholder_key
STRIPE_WEBHOOK_SECRET=whsec_placeholder_secret

# Brevo SMTP Settings
BREVO_USER=unmeshbhangale41@gmail.com
BREVO_SMTP_KEY=xsmtpsib-dcdb0de7297534d823a9703a3b0ac6d8c3a538af96441ee613022a1df3f8c7ed-8ffDRse0GtEkwaUn

# Cloudinary Settings
CLOUDINARY_CLOUD_NAME=dzmsihnam
CLOUDINARY_API_KEY=261764173438511
CLOUDINARY_API_SECRET=wjE-Ay8qKOu4lUx9EjIRY9UhBHM

# Firebase Admin Credentials
FIREBASE_PROJECT_ID=myshopee-6614d
FIREBASE_CLIENT_EMAIL=unmeshbhangale41@gmail.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC+tzlJZqum3maS\n..."
```

### Frontend Config (`frontend/.env`)
Create a file named `.env` in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api

# Firebase Web configuration
VITE_FIREBASE_API_KEY=AIzaSyCjbs9_MgncXvLa3PciGU7RQjeTit1BB5g
VITE_FIREBASE_AUTH_DOMAIN=myshopee-6614d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=myshopee-6614d
VITE_FIREBASE_STORAGE_BUCKET=myshopee-6614d.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=800733787146
VITE_FIREBASE_APP_ID=1:800733787146:web:6c7bef9d3955a98aa89bf3

# Stripe Publishable Key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder_key
```

---

## 🗄️ Step 2: Database Initialization

To create all SQL tables, foreign key constraints, and default indexes:

1. Navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Execute the database initialization script:
   ```bash
   node src/db/init.js
   ```
   *(This reads `src/db/init.sql` and executes it directly on your Neon Postgres database, setting up a fresh schema)*

---

## 🚀 Step 3: Run the Application

You can launch the backend and frontend dev servers concurrently.

### 1. Launch Backend Server
1. Navigate to `backend/` and start the Nodemon dev watcher:
   ```bash
   cd backend
   ```
2. Run development script:
   ```bash
   npm run dev
   ```
   The backend should start listening on `http://localhost:5000`. You will see console verification prints for Firebase Admin, Cloudinary, and Brevo SMTP connections.

### 2. Launch Frontend Client
1. Open a new terminal tab, navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173` to see the live premium user interface.

---

## 🧪 Step 4: Verification Checklist

1. **User Sign Up**: Visit the Register page, sign up a new account. The application will auto-synchronize with your local PostgreSQL `users` table and trigger a welcome email.
2. **Promote to Admin**: Go to the Profile page, click **Become Administrator** to immediately elevate your account role to `admin` for testing.
3. **Import Demo Products**: Navigate to the Admin Dashboard (a shield icon will appear in the navbar) and click **Import Demo Products**. The backend will download 30 products, upload their thumbnails to Cloudinary, and save them.
4. **Mock Checkout**: Add items to your cart, navigate to the cart page, and click **Proceed to Checkout**. Because Stripe keys are left as placeholders, the application will redirect to a simulated mock checkout. Click confirm to invoke the mock webhook, which clears your cart, creates the order, reduces stock, and sends an order confirmation email.
5. **Update Tracking**: Go back to the Admin Dashboard, view the order in the list, change its status (e.g. `Shipped`), and hit update. Under your account `/orders` dashboard, the tracking progress timeline bar will update live.
