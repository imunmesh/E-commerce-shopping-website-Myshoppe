# MyShopee REST API Specification

This document lists the available API endpoints, parameters, header requirements, and return structures for MyShopee.

---

## 🔒 Authentication & Headers

All endpoints except `GET /api/products` (list products), `GET /api/products/:id` (product detail), and `GET /api/products/categories` (get categories) require a secure Firebase JWT ID Token passed in the headers.

### Header Format
```http
Authorization: Bearer <FIREBASE_JWT_ID_TOKEN>
Content-Type: application/json
```

---

## 👤 Auth Endpoints (`/api/auth`)

### 1. `GET /api/auth/sync`
Verifies user credentials and registers the user in PostgreSQL database if they are signing in for the first time.
* **Access**: Authenticated
* **Response**: `200 OK`
  ```json
  {
    "message": "User synchronized successfully.",
    "user": {
      "id": 1,
      "firebase_uid": "uid_code",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "customer",
      "created_at": "2026-05-30T14:20:00Z"
    }
  }
  ```

### 2. `PUT /api/auth/profile`
Updates the name of the user profile.
* **Access**: Authenticated
* **Request Body**:
  ```json
  { "name": "Jane Smith" }
  ```
* **Response**: `200 OK`

### 3. `POST /api/auth/make-admin`
Development bypass to promote user role to `admin` for testing.
* **Access**: Authenticated
* **Response**: `200 OK`

---

## 🛍️ Product Endpoints (`/api/products`)

### 1. `GET /api/products`
Retrieves products list with search, sorting, filtering, and pagination.
* **Access**: Public
* **Query Parameters**:
  * `search` (string) - partial match title/description
  * `category` (string) - exact category match
  * `brand` (string) - brand match
  * `minPrice` / `maxPrice` (numbers)
  * `sort` (string) - `price`, `rating`, `created_at`, `title`
  * `order` (string) - `asc` or `desc`
  * `page` (number) - default `1`
  * `limit` (number) - default `12`
* **Response**: `200 OK`
  ```json
  {
    "products": [
      {
        "id": 1,
        "title": "iPhone 15 Pro",
        "description": "Premium Apple phone",
        "category": "smartphones",
        "brand": "Apple",
        "price": "999.00",
        "discount": "5.00",
        "rating": "4.80",
        "stock": 25,
        "created_at": "2026-05-30T14:20:00Z",
        "images": ["https://res.cloudinary.com/dzmsihnam/image/upload/v1/..."]
      }
    ],
    "pagination": {
      "totalItems": 1,
      "totalPages": 1,
      "currentPage": 1,
      "limit": 12
    }
  }
  ```

### 2. `GET /api/products/categories`
Returns distinct list of categories.
* **Access**: Public
* **Response**: `200 OK` `["smartphones", "laptops", ...]`.

### 3. `GET /api/products/:id`
Retrieves detailed single product with reviews timeline and thumbnail gallery.
* **Access**: Public
* **Response**: `200 OK`

### 4. `POST /api/products`
Creates a product. Supports multi-file uploads to Cloudinary.
* **Access**: Admin only
* **Request Header**: `Content-Type: multipart/form-data`
* **Form Fields**: `title`, `description`, `category`, `brand`, `price`, `discount`, `stock`
* **Files**: Key `images` (array of image files, max 5)
* **Response**: `201 Created`

### 5. `DELETE /api/products/:id`
Deletes a product and its associated Cloudinary images.
* **Access**: Admin only
* **Response**: `200 OK`

---

## 🛒 Cart Endpoints (`/api/cart`)

### 1. `GET /api/cart`
Calculates subtotal, discounts, tax (8%), and total.
* **Access**: Authenticated
* **Response**: `200 OK`

### 2. `POST /api/cart`
Adds item to cart. Checks stock availability.
* **Access**: Authenticated
* **Request Body**:
  ```json
  { "productId": 1, "quantity": 2 }
  ```
* **Response**: `200 OK`

### 3. `PUT /api/cart/items/:itemId`
Modifies item quantity. Checks stock.
* **Access**: Authenticated
* **Request Body**:
  ```json
  { "quantity": 3 }
  ```
* **Response**: `200 OK`

---

## 💳 Payment Endpoints (`/api/payment`)

### 1. `POST /api/payment/create-checkout-session`
Launches checkout sessions. If Stripe secret key is placeholder, returns mock URL.
* **Access**: Authenticated
* **Response**: `200 OK`
  ```json
  {
    "id": "cs_test_12345...",
    "url": "https://checkout.stripe.com/pay/...",
    "isMock": false
  }
  ```

### 2. `POST /api/payment/mock-webhook`
Bypasses Stripe for review testing, immediately creates orders, updates DB, clears cart, and emails receipt.
* **Access**: Authenticated
* **Request Body**:
  ```json
  {
    "sessionId": "mock_sess_12345",
    "items": "1:2,3:1",
    "amount": "2054.50"
  }
  ```
* **Response**: `200 OK`

---

## 📦 Order Endpoints (`/api/orders`)

### 1. `GET /api/orders`
Retrieves customer's orders history. If Admin, returns all orders.
* **Access**: Authenticated
* **Response**: `200 OK`

### 2. `GET /api/orders/:id/tracking`
Retrieves history logs of tracking timeline.
* **Access**: Authenticated
* **Response**: `200 OK`

### 3. `PUT /api/orders/:id/status`
Updates order tracking status. Triggers shipping or delivery Brevo email.
* **Access**: Admin only
* **Request Body**:
  ```json
  {
    "status": "Shipped",
    "message": "Package handed over to DHL Express."
  }
  ```
* **Response**: `200 OK`
