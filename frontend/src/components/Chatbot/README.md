# MyShopee AI Shopping Assistant Chatbox

The MyShopee AI Shopping Assistant is an intelligent, multi-modal conversational chatbot widget embedded in the MyShopee customer UI. It acts as an autonomous sales agent and support representative capable of executing complex e-commerce workflows directly from user conversation.

---

## 🚀 Core Features

### 1. Conversational Engine & Smart Fallbacks
* **Gemini ReAct Tool Calling**: Powered by Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) utilizing ReAct tool calling to fetch live database records, specifications, and user states.
* **Offline Mock Fallback Mode**: If the Gemini API key is missing or fails, the chatbot switches to a localized rule-based agent matching queries (via regex and text analysis) to corresponding database tools so the widget remains 100% functional.

### 2. Multi-Modal Interaction
* **Voice Input (Speech-to-Text)**: Features a microphone button powered by the browser's native **Web Speech Recognition API** for voice dictation.
* **Voice Output (Text-to-Speech)**: Includes a speaker toggle powered by the **Web Speech Synthesis API** to read chatbot responses aloud. It automatically strips Markdown symbols for a clean, natural-sounding voice output.

### 3. Session & History Management
* **Multi-Session Chats**: Shoppers can start new conversations, switch between previous chats, and delete conversations.
* **Database Persistence**: Session titles and full message transcripts are saved in the PostgreSQL database (`chat_sessions` and `chat_messages` tables) for logged-in users.
* **Session Persistence**: Chat session UUIDs are cached in `localStorage` to preserve active conversations across page reloads.

### 4. Interactive E-Commerce Agent Tools
The chatbot has direct access to the database via specialized backend service tools:
* **Product Search & Discovery**: Uses `searchProducts` to filter the catalog by keyword, categories, brands, and price limits.
* **Personalized Brand & Budget Memory**: Stores user preferences (favorite brands, categories, price budgets) in the `user_preferences` table via `updateUserPreferences` to customize future recommendations.
* **Compare Specs**: Compares pricing, ratings, and features for up to 4 products side-by-side using `compareProducts`.
* **Reviews Intelligence**: Pulls product feedback using `getProductReviews` and summarizes customer sentiment into a concise **Pros & Cons** list.
* **Real-time Cart Management**: Allows users to view their cart (`viewCart`), add products (`addToCart`), remove products (`removeFromCart`), and request an invoice breakdown (`checkoutSummary`) listing applicable coupons.
* **Inventory Stock Levels**: Queries `checkInventory` to retrieve stock quantities and dispatch warehouse locations.
* **Order Status & Live Courier Tracking**: Retrieves order progress using `getOrderStatus` or tracks packages in real-time from courier partners (Delhivery, Blue Dart, DTDC, etc.) via `getLiveTracking` with active milestones.
* **Returns & Claims Handler**: Checks item return windows (7 days or 120s fast-track) using `checkReturnEligibility` and submits return claims using `createReturnRequest`.

### 5. Client State Synchronization
* **Cart Synchronizer**: When the AI chatbot adds or removes items in the database cart, it dispatches Redux events (`fetchCart`) to dynamically update the cart icon and checkout counters in the page header without reloading.
* **Auth Guarding**: If the user tries to run account-specific tools (like checking orders or returns) when signed out, the agent politely prompts them to authenticate using the login button in the header.

---

## 🛠️ File Structure

* **`ChatWidget.jsx`**: The main floating widget container. Manages the sidebar sessions list, message histories, speech synthesis, and cart Redux dispatch updates.
* **`ChatInput.jsx`**: Manages the message entry form, submit event handoff, and Speech Recognition recording state.
* **`ChatMessage.jsx`**: Renders individual user/bot messages, typing animations, markdown parsing, and product recommendation cards.
* **`chatService.js`**: Frontend API client sending queries to backend routes.
* **`chatbotService.js`**: Backend controller that orchestrates the Gemini conversation loop, runs the offline mock agent, and invokes database tools.
* **`geminiService.js`**: Declares tool schemas, system instructions, and handles the Gemini API REST endpoint calls.
