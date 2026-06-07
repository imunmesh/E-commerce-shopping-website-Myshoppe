# MyShopee - Production Ready Full Stack E-Commerce Platform

MyShopee is a premium, full-featured, Amazon-inspired E-Commerce platform. It is engineered with a modern tech stack utilizing React.js, Node.js, Express.js, PostgreSQL (Neon), Firebase Authentication, Stripe Payments, Cloudinary Media storage, and Brevo Email Services.

The platform is designed to be fully scalable, production-ready, and optimized for deployment on Firebase Hosting (frontend) and Render (backend).

---

## 🚀 Key Features

### Customer Experience
* **Premium Amazon-Inspired UI**: Responsive layout tailored for mobile, tablet, and desktop screens with custom glassmorphism components.
* **Firebase Authentication**: Email/Password registrations, password reset triggers, and secure session persistence.
* **Product Catalog**: Advanced search, filtering (categories, brand, price ranges), sorting (pricing, ratings, dates), and paginated grids.
* **Rich Product Details**: Image galleries (Cloudinary-hosted), detailed descriptions, inventory stock levels, and review timelines.
* **Shopping Cart & Wishlist**: Real-time quantity adjustments, automatic tax (8%) & discount calculations, and move-to-cart actions.
* **Stripe Payment Checkout**: Secure mock or live Stripe checkout sessions.
* **Live Order Tracking**: Dynamic progress timeline tracking (Placed -> Confirmed -> Packed -> Shipped -> Out for Delivery -> Delivered) with status change notification emails.
* **Ratings & Reviews**: Write, edit, and delete reviews with real-time product average rating updates.

### Administrator Console
* **Revenue Dashboard**: Aggregated tiles of total sales income, active inventory units, registered users, and product types.
* **Recharts Visualizations**: Interactive Area, Line, and Bar charts for monthly revenue, customer acquisition growth, and top-selling products.
* **DummyJSON Product Import**: Instant seeder system that fetches products, downloads/uploads thumbnails to Cloudinary to prevent broken assets, and inserts them into PostgreSQL skipping duplicates.
* **Order Status Director**: Manage customer shipments and advance order statuses to automatically trigger transactional Brevo notifications.
* **Products CRUD Manager**: Create custom products (supporting multi-file uploads to Cloudinary via Multer) and delete products (which triggers Cloudinary API image purging).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Redux Toolkit, React Router, Recharts, Axios, Lucide Icons |
| **Backend** | Node.js, Express.js, pg (PostgreSQL Client), Multer, Helmet, Express Rate Limit |
| **Database** | Neon Serverless PostgreSQL |
| **Authentication** | Firebase Authentication & Firebase Admin SDK |
| **Payments** | Stripe Checkout API & Stripe Webhooks |
| **Storage** | Cloudinary Image Hosting |
| **Emails** | Brevo SMTP (via Nodemailer) |

---

## 📂 Project Structure

```text
myshopee/
├── backend/
│   ├── src/
│   │   ├── config/          # SDK Configs (Firebase Admin, Cloudinary, SMTP)
│   │   ├── db/              # SQL Initialization and Pool Client
│   │   ├── middleware/      # Auth tokens verification & Cloudinary Multer uploads
│   │   ├── routes/          # RESTful Endpoint Routers (Auth, Products, Orders, etc.)
│   │   ├── utils/           # HTML Transactional Emails Utility
│   │   └── index.js         # API Server Entry Point
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI Blocks (Navbar, Footer, ProductCard, etc.)
│   │   ├── firebase/        # Web SDK client connection
│   │   ├── pages/           # Pages (Home, Detail, Cart, Orders, Admin, Profile)
│   │   ├── store/           # Redux slices (Auth, Cart, Wishlist)
│   │   ├── utils/           # Axios Interceptor with Firebase Bearer Tokens
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
```

---

## 📖 Related Documents

Detailed setup and execution guides are available:
* **[SETUP.md](file:///c:/Users/Unmesh/Myshopee/SETUP.md)**: Steps to configure local database, credentials, and launch servers.
* **[DEPLOYMENT.md](file:///c:/Users/Unmesh/Myshopee/DEPLOYMENT.md)**: Directives for deploying to Firebase Hosting, Render, and Neon.
* **[DATABASE.md](file:///c:/Users/Unmesh/Myshopee/DATABASE.md)**: Database schema maps, constraints, and relationships.
* **[API.md](file:///c:/Users/Unmesh/Myshopee/API.md)**: Detailed API specification, endpoints, parameters, and payloads.

---

## 🤖 AI Shopping Assistant Chatbot (Agent-Powered)

MyShopee includes a state-of-the-art AI Shopping Assistant designed using the **Gemini 1.5 Flash API**. Rather than giving boilerplate answers, the assistant behaves like an **AI Agent with access to tools**:

1. **Tool calling loop:** The agent parses the user's intent and requests function calls to look up databases in real-time.
2. **Dynamic Contexts:** Product search queries, side-by-side product comparisons, order tracking, and coupons are fetched directly from your live Neon PostgreSQL database.
3. **Conversational Memory:** Stores sessions and message histories separately in the database to remember follow-up queries.

### Docker Support

To run the entire stack (React frontend + Node API backend) locally in Docker containers:
```bash
# 1. Provide your live GEMINI_API_KEY in docker-compose.yml
# 2. Build and run containers
docker-compose up --build
```
The frontend will be available at `http://localhost` and backend API at `http://localhost:5000`.

Detailed guides:
* **[Firebase Hosting Deployment Guide](file:///C:/Users/Unmesh/.gemini/antigravity/brain/e9d6d1bd-6c4f-4950-8030-5fd1d0037c34/firebase_hosting_guide.md)**: Steps to deploy the React chatbot frontend to Firebase.

