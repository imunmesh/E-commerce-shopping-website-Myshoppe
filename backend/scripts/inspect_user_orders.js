const db = require('../src/db');

const checkOrders = async () => {
  try {
    console.log('--- Fetching all orders ---');
    const ordersRes = await db.query('SELECT * FROM orders');
    console.log('Orders found:', ordersRes.rows);

    for (const order of ordersRes.rows) {
      console.log(`\n--- Order Items for Order #${order.id} ---`);
      const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      console.log(itemsRes.rows);

      for (const item of itemsRes.rows) {
        const prodRes = await db.query('SELECT id, title, thumbnail FROM products WHERE id = $1', [item.product_id]);
        console.log(`Product ID ${item.product_id} in Products Table:`, prodRes.rows[0]);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkOrders();
