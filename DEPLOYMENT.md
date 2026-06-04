# MyShopee - Production Deployment Guide

This document guides you through deploying MyShopee to production environments.

---

## 🗄️ 1. Database: Neon PostgreSQL

Neon is serverless PostgreSQL. The database is already initialized and provisioned.
* Connect to your database using the connection string in your environment config.
* Note that Neon handles connection pooling, which is recommended for high-traffic servers.
* No additional configuration is required.

---

## 🔌 2. Backend Hosting: Render

Render is ideal for deploying Node.js web services.

### Steps to Deploy:
1. Create a free account at [render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Link your GitHub repository.
4. Set the following details:
   * **Name**: `myshopee-backend`
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Click **Advanced** to add environment variables. Copy the contents of your `backend/.env` file:
   * `NODE_ENV`: `production`
   * `DATABASE_URL`: `your_neon_db_url`
   * `CLIENT_URL`: `https://your-firebase-subdomain.web.app`
   * `STRIPE_SECRET_KEY`: `your_live_stripe_secret_key`
   * `STRIPE_WEBHOOK_SECRET`: `your_live_stripe_webhook_secret`
   * `BREVO_USER`: `your_brevo_user`
   * `BREVO_SMTP_KEY`: `your_brevo_smtp_key`
   * `CLOUDINARY_CLOUD_NAME`: `your_cloudinary_cloud_name`
   * `CLOUDINARY_API_KEY`: `your_cloudinary_api_key`
   * `CLOUDINARY_API_SECRET`: `your_cloudinary_api_secret`
   * `FIREBASE_PROJECT_ID`: `myshopee-6614d`
   * `FIREBASE_CLIENT_EMAIL`: `your_firebase_client_email`
   * `FIREBASE_PRIVATE_KEY`: `your_firebase_private_key`
6. Click **Deploy Web Service**. Render will build and start your Node API server, giving you a public URL (e.g. `https://myshopee-backend.onrender.com`).

---

## 🌐 3. Frontend Hosting: Firebase Hosting

Firebase Hosting is perfect for static web applications like Vite React single page apps.

### Steps to Deploy:

#### A. Install Firebase CLI Globally
If you do not have Firebase CLI installed:
```bash
npm install -g firebase-tools
```

#### B. Sign In to Firebase
Authenticate the CLI with your Google account:
```bash
firebase login
```

#### C. Initialize Firebase Project
From the root of the project workspace (`myshopee/`):
1. Run the initialization script:
   ```bash
   firebase init hosting
   ```
2. Make the following choices:
   * **Project Setup**: Choose *Use an existing project* and select `myshopee-6614d`.
   * **Public Directory**: Type `frontend/dist` (Vite's build output directory).
   * **Configure as a single-page app**: Choose `Yes` (so that React Router path redirects are handled correctly).
   * **Set up automatic builds and deploys with GitHub**: Choose `No`.

This creates a `firebase.json` configuration and a `.firebaserc` file.

#### D. Build the Frontend Code
Make sure you update the API URL in `frontend/.env` to point to your new live Render service:
```env
VITE_API_URL=https://myshopee-backend.onrender.com/api
```
Run the build inside the `frontend/` folder:
```bash
cd frontend
npm run build
```
This compiles the code into `frontend/dist`.

#### E. Deploy to Live hosting
Run the deployment command:
```bash
firebase deploy --only hosting
```
Once completed, Firebase CLI will print your live hosting URL:
`https://myshopee-6614d.web.app`

---

## 💳 4. Payments: Stripe Live Webhooks

Once both backend and frontend are live, you need to configure Stripe webhooks.

1. Go to your **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Click **Add Endpoint**.
3. Input your live Render webhook URL:
   `https://myshopee-backend.onrender.com/api/payment/webhook`
4. Select the events to listen to:
   * `checkout.session.completed`
   * `payment_intent.succeeded`
   * `payment_intent.payment_failed`
   * `charge.refunded`
5. Copy the generated **Signing Secret** (looks like `whsec_...`).
6. Go to your **Render Web Service settings**, edit your environment variables, and replace `STRIPE_WEBHOOK_SECRET` with this signing secret.
7. Restart your Render service.
