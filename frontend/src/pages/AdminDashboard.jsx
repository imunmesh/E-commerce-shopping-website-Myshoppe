import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { Database, TrendingUp, ShoppingCart, Users, Package, RefreshCw, Plus, Trash2, Edit, Award } from 'lucide-react';
import api from '../utils/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  // Redirect if not admin
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/');
    }
  }, [user, isAuthenticated, navigate]);

  // Analytics states
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    inventoryOverview: 0,
    recentOrders: []
  });
  const [chartData, setChartData] = useState({
    monthlySales: [],
    customerGrowth: [],
    topProducts: []
  });
  const [loading, setLoading] = useState(true);

  // Product CRUD states
  const [productsList, setProductsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState('');

  // Add Product form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDiscount, setNewDiscount] = useState('0');
  const [newStock, setNewStock] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  // Order Management states
  const [ordersList, setOrdersList] = useState([]);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState({});

  // Coupon Management states
  const [couponsList, setCouponsList] = useState([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponType, setCouponType] = useState('percentage');
  const [couponVal, setCouponVal] = useState('');
  const [couponMinAmount, setCouponMinAmount] = useState('0');
  const [couponLimit, setCouponLimit] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [couponActive, setCouponActive] = useState(true);
  const [couponSubmitLoading, setCouponSubmitLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const metricsPromise = api.get('/admin/analytics');
      const chartsPromise = api.get('/admin/charts');
      const productsPromise = api.get('/products?limit=50');
      const categoriesPromise = api.get('/products/categories');
      const ordersPromise = api.get('/orders');
      const couponsPromise = api.get('/coupons');

      const [metricsRes, chartsRes, productsRes, categoriesRes, ordersRes, couponsRes] = await Promise.all([
        metricsPromise,
        chartsPromise,
        productsPromise,
        categoriesPromise,
        ordersPromise,
        couponsPromise
      ]);

      setMetrics(metricsRes.data);
      setChartData(chartsRes.data);
      setProductsList(productsRes.data.products);
      setCategoriesList(categoriesRes.data);
      setOrdersList(ordersRes.data);
      setCouponsList(couponsRes.data);

      // Initialize status selectors
      const statusMap = {};
      ordersRes.data.forEach(o => {
        statusMap[o.id] = o.order_status;
      });
      setSelectedOrderStatus(statusMap);

    } catch (error) {
      console.error('Failed to load admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Product Import
  const handleImportProducts = async () => {
    setImportLoading(true);
    setImportResult('');
    try {
      const response = await api.post('/admin/import-products');
      setImportResult(`Demo products import successful! Imported: ${response.data.importedCount}. Duplicates skipped: ${response.data.duplicateCount}.`);
      await loadDashboardData(); // reload
    } catch (error) {
      console.error(error);
      setImportResult('Import operation failed. Verify backend logs.');
    } finally {
      setImportLoading(false);
    }
  };

  // Product Deletion
  const handleDeleteProduct = async (id) => {
    if (window.confirm('Are you sure you want to delete this product? This will also remove associated image assets from Cloudinary.')) {
      try {
        await api.delete(`/products/${id}`);
        alert('Product and assets deleted successfully.');
        await loadDashboardData();
      } catch (error) {
        console.error(error);
        alert('Failed to delete product.');
      }
    }
  };

  // Create Product with Multer Upload
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setCreateLoading(true);

    const formData = new FormData();
    formData.append('title', newTitle);
    formData.append('description', newDesc);
    formData.append('category', newCategory);
    formData.append('brand', newBrand);
    formData.append('price', newPrice);
    formData.append('discount', newDiscount);
    formData.append('stock', newStock);

    // Append files
    for (const img of selectedImages) {
      formData.append('images', img);
    }

    try {
      await api.post('/products', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Product created successfully and images uploaded to Cloudinary!');
      setShowAddForm(false);
      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewCategory('');
      setNewBrand('');
      setNewPrice('');
      setNewDiscount('0');
      setNewStock('');
      setSelectedImages([]);

      await loadDashboardData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to create product.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId) => {
    const status = selectedOrderStatus[orderId];
    try {
      await api.put(`/orders/${orderId}/status`, {
        status,
        message: `Package status advanced to ${status}.`
      });
      alert(`Order #${orderId} advanced to ${status}. Notification email triggered.`);
      await loadDashboardData();
    } catch (error) {
      console.error(error);
      alert('Failed to update order status.');
    }
  };

  const handleStatusSelectChange = (orderId, value) => {
    setSelectedOrderStatus(prev => ({ ...prev, [orderId]: value }));
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setCouponSubmitLoading(true);

    const payload = {
      code: couponCode,
      description: couponDesc,
      discount_type: couponType,
      discount_value: couponVal,
      minimum_order_amount: couponMinAmount,
      usage_limit: couponLimit || null,
      expiry_date: couponExpiry || null,
      is_active: couponActive
    };

    try {
      await api.post('/coupons', payload);
      alert('Coupon created successfully!');
      
      // Reset form
      setCouponCode('');
      setCouponDesc('');
      setCouponType('percentage');
      setCouponVal('');
      setCouponMinAmount('0');
      setCouponLimit('');
      setCouponExpiry('');
      setCouponActive(true);
      setShowCouponForm(false);

      // Reload
      const res = await api.get('/coupons');
      setCouponsList(res.data);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'Failed to create coupon.');
    } finally {
      setCouponSubmitLoading(false);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        await api.delete(`/coupons/${id}`);
        alert('Coupon deleted successfully.');
        // Reload
        const res = await api.get('/coupons');
        setCouponsList(res.data);
      } catch (error) {
        console.error(error);
        alert('Failed to delete coupon.');
      }
    }
  };

  const handleImageFileChange = (e) => {
    setSelectedImages(Array.from(e.target.files));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="animate-spin text-amazon-orange mb-4" size={40} />
        <p className="text-gray-500 font-bold">Assembling Admin Dashboard control panel...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Visual Header */}
      <div className="bg-gradient-to-r from-amazon-blue to-amazon-lightBlue p-6 rounded-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm border border-gray-800">
        <div className="flex items-center space-x-3">
          <Award size={36} className="text-amazon-yellow" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Admin Control Board</h1>
            <p className="text-xs text-gray-300 font-medium">Manage imports, products inventory, customer orders, and analytics charts</p>
          </div>
        </div>

        {/* Demo Import Button */}
        <div className="shrink-0 flex items-center space-x-2">
          {importLoading ? (
            <div className="flex items-center space-x-2 bg-amazon-orange text-white px-5 py-2.5 rounded-md font-bold text-xs">
              <RefreshCw size={14} className="animate-spin" />
              <span>Importing DummyJSON products...</span>
            </div>
          ) : (
            <button
              onClick={handleImportProducts}
              className="bg-amazon-yellow text-amazon-blue px-5 py-2.5 rounded-md font-bold text-xs hover:bg-opacity-95 shadow transition"
            >
              Import Demo Products
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm font-semibold rounded-lg p-4 shadow-sm">
          💡 {importResult}
        </div>
      )}

      {/* 1. KEY METRICS TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Total Revenue</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">${metrics.totalRevenue.toFixed(2)}</p>
          </div>
          <TrendingUp className="text-green-500 bg-green-50 p-2 rounded-full" size={40} />
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Total Orders</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{metrics.totalOrders}</p>
          </div>
          <ShoppingCart className="text-blue-500 bg-blue-50 p-2 rounded-full" size={40} />
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Customers</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{metrics.totalCustomers}</p>
          </div>
          <Users className="text-purple-500 bg-purple-50 p-2 rounded-full" size={40} />
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Product Types</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{metrics.totalProducts}</p>
          </div>
          <Package className="text-orange-500 bg-orange-50 p-2 rounded-full" size={40} />
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Stock Units</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{metrics.inventoryOverview}</p>
          </div>
          <Database className="text-gray-500 bg-gray-50 p-2 rounded-full" size={40} />
        </div>
      </div>

      {/* 2. RECHARTS ANALYTICS GRAPH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sales & Revenue Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm">Monthly Revenue & Orders</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.monthlySales}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f08804" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f08804" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#f08804" fillOpacity={1} fill="url(#colorRev)" name="Revenue ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Growth Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm">Customer Acquisitions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.customerGrowth}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="customers" stroke="#2b6cb0" strokeWidth={2} name="Total Customers" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products sold */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-bold text-gray-900 text-sm">Top Selling Products</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.topProducts}>
                <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="sold" fill="#febd69" radius={[4, 4, 0, 0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. ORDER MANAGEMENT PANEL */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="font-extrabold text-gray-900 text-lg border-b border-gray-100 pb-3">
          Manage Customer Orders
        </h3>
        
        {ordersList.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No orders written in database yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px]">
                  <th className="py-3">Order ID</th>
                  <th className="py-3">Customer</th>
                  <th className="py-3">Invoice Amount</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map((ord) => (
                  <tr key={ord.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3.5 font-bold">#{ord.id}</td>
                    <td className="py-3.5 font-medium">
                      <p>{ord.user_name}</p>
                      <p className="text-xs text-gray-400">{ord.user_email}</p>
                    </td>
                    <td className="py-3.5 font-bold text-amazon-orange">${parseFloat(ord.total_amount).toFixed(2)}</td>
                    <td className="py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ord.order_status === 'Delivered' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {ord.order_status}
                      </span>
                    </td>
                    <td className="py-3.5 flex items-center space-x-2">
                      <select
                        value={selectedOrderStatus[ord.id] || ord.order_status}
                        onChange={(e) => handleStatusSelectChange(ord.id, e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-xs rounded p-1.5 focus:outline-none"
                      >
                        <option value="Placed">Placed</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Packed">Packed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Out For Delivery">Out For Delivery</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id)}
                        className="bg-amazon-lightBlue text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-opacity-95"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. PRODUCTS INVENTORY MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="font-extrabold text-gray-900 text-lg">
            Manage Products Inventory
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amazon-orange text-white px-4 py-2 rounded-md font-bold text-xs flex items-center space-x-1 hover:bg-opacity-95 shadow"
          >
            <Plus size={14} />
            <span>{showAddForm ? 'Close Form' : 'Add Custom Product'}</span>
          </button>
        </div>

        {/* Create Product Form */}
        {showAddForm && (
          <form onSubmit={handleCreateProduct} className="bg-gray-50/50 p-6 rounded-lg border border-gray-200 space-y-4 max-w-2xl">
            <h4 className="font-bold text-gray-900 text-sm">Add New Product Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Product Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                required
              />
              <input
                type="text"
                placeholder="Brand Name"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                required
              />
            </div>

            <textarea
              placeholder="Product Description"
              rows="3"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
              required
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="Price ($)"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="0.01"
                step="0.01"
                required
              />
              <input
                type="number"
                placeholder="Discount (%)"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="0"
                max="99"
              />
              <input
                type="number"
                placeholder="Inventory Stock"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="0"
                required
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none"
                required
              >
                <option value="">Select Category</option>
                {categoriesList.length > 0 ? (
                  categoriesList.map(c => <option key={c} value={c}>{c}</option>)
                ) : (
                  <>
                    <option value="smartphones">smartphones</option>
                    <option value="laptops">laptops</option>
                    <option value="fragrances">fragrances</option>
                  </>
                )}
              </select>
            </div>

            {/* Cloudinary Multi File Uploader */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Product Image Gallery Files (Multi-upload to Cloudinary)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageFileChange}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                required
              />
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="bg-amazon-orange text-white px-5 py-2.5 rounded font-bold text-xs shadow hover:bg-opacity-95 transition"
            >
              {createLoading ? 'Uploading Files to Cloudinary...' : 'Create & Save Product'}
            </button>

          </form>
        )}

        {/* Products Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px]">
                <th className="py-3">Image</th>
                <th className="py-3">Title</th>
                <th className="py-3">Category</th>
                <th className="py-3">Price</th>
                <th className="py-3">Stock</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsList.map((prod) => {
                const imgList = Array.isArray(prod.images) ? prod.images : [];
                const imgUrl = imgList.length > 0 ? (typeof imgList[0] === 'string' ? imgList[0] : imgList[0].image_url) : '';
                
                return (
                  <tr key={prod.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2">
                      <div className="w-10 h-10 bg-gray-50 border p-1 rounded flex items-center justify-center">
                        <img src={imgUrl} alt="inventory-thumb" className="max-h-full max-w-full object-contain" />
                      </div>
                    </td>
                    <td className="py-2 font-bold max-w-xs truncate">{prod.title}</td>
                    <td className="py-2 uppercase text-xs text-gray-400">{prod.category}</td>
                    <td className="py-2 font-extrabold text-amazon-orange">${parseFloat(prod.price).toFixed(2)}</td>
                    <td className="py-2 font-semibold">
                      {prod.stock <= 3 ? (
                        <span className="text-red-600 bg-red-50 py-0.5 px-2 rounded-full text-xs font-bold">
                          Low: {prod.stock}
                        </span>
                      ) : (
                        <span className="text-gray-700">{prod.stock}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                        title="Delete product and Cloudinary assets"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. COUPON MANAGEMENT PANEL */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h3 className="font-extrabold text-gray-900 text-lg">
            Manage Promo Coupons
          </h3>
          <button
            onClick={() => setShowCouponForm(!showCouponForm)}
            className="bg-amazon-orange text-white px-4 py-2 rounded-md font-bold text-xs flex items-center space-x-1 hover:bg-opacity-95 shadow"
          >
            <Plus size={14} />
            <span>{showCouponForm ? 'Close Form' : 'Create Coupon'}</span>
          </button>
        </div>

        {/* Create Coupon Form */}
        {showCouponForm && (
          <form onSubmit={handleCreateCoupon} className="bg-gray-50/50 p-6 rounded-lg border border-gray-200 space-y-4 max-w-2xl">
            <h4 className="font-bold text-gray-900 text-sm">Create New Promo Coupon</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Coupon Code (e.g. SUMMER20)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow uppercase font-mono font-bold"
                required
              />
              <input
                type="text"
                placeholder="Description"
                value={couponDesc}
                onChange={(e) => setCouponDesc(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <select
                value={couponType}
                onChange={(e) => setCouponType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                required
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
              <input
                type="number"
                placeholder="Value"
                value={couponVal}
                onChange={(e) => setCouponVal(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="0.01"
                step="0.01"
                required
              />
              <input
                type="number"
                placeholder="Min Order Amount ($)"
                value={couponMinAmount}
                onChange={(e) => setCouponMinAmount(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="0"
                step="0.01"
              />
              <input
                type="number"
                placeholder="Usage Limit"
                value={couponLimit}
                onChange={(e) => setCouponLimit(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                min="1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={couponExpiry}
                  onChange={(e) => setCouponExpiry(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amazon-yellow"
                />
              </div>
              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="couponActive"
                  checked={couponActive}
                  onChange={(e) => setCouponActive(e.target.checked)}
                  className="w-4 h-4 text-amazon-orange focus:ring-amazon-orange rounded border-gray-300"
                />
                <label htmlFor="couponActive" className="text-xs font-bold text-gray-700 select-none">Is Active</label>
              </div>
            </div>

            <button
              type="submit"
              disabled={couponSubmitLoading}
              className="bg-amazon-orange text-white px-5 py-2.5 rounded font-bold text-xs shadow hover:bg-opacity-95 transition"
            >
              {couponSubmitLoading ? 'Saving...' : 'Create Coupon'}
            </button>
          </form>
        )}

        {/* Coupons List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase text-[10px]">
                <th className="py-3">Code</th>
                <th className="py-3">Type</th>
                <th className="py-3">Value</th>
                <th className="py-3">Min Order</th>
                <th className="py-3">Usage</th>
                <th className="py-3">Expiry</th>
                <th className="py-3">Status</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {couponsList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-gray-400 text-xs">No active coupons available.</td>
                </tr>
              ) : (
                couponsList.map((cp) => (
                  <tr key={cp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2.5 font-bold font-mono tracking-wider text-amazon-blue">{cp.code}</td>
                    <td className="py-2.5 capitalize text-xs text-gray-500">{cp.discount_type}</td>
                    <td className="py-2.5 font-extrabold text-gray-800">
                      {cp.discount_type === 'percentage' ? `${parseFloat(cp.discount_value)}%` : `$${parseFloat(cp.discount_value).toFixed(2)}`}
                    </td>
                    <td className="py-2.5 font-semibold text-gray-500">${parseFloat(cp.minimum_order_amount || 0).toFixed(2)}</td>
                    <td className="py-2.5 text-xs font-semibold text-gray-600">
                      {cp.used_count} / {cp.usage_limit || '∞'}
                    </td>
                    <td className="py-2.5 text-xs text-gray-400">
                      {cp.expiry_date ? new Date(cp.expiry_date).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-2.5">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        cp.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {cp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => handleDeleteCoupon(cp.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                        title="Delete Coupon"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
