import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Calendar, DollarSign, Package, Truck, Clock, CheckCircle2, ChevronRight, ChevronDown, FileText } from 'lucide-react';
import api from '../utils/api';

const Orders = () => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  
  // Tracking & details of expanded order
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderTracking, setOrderTracking] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setOrderDetails(null);
      setOrderTracking([]);
      return;
    }

    setExpandedOrderId(orderId);
    setDetailsLoading(true);
    setOrderDetails(null);
    setOrderTracking([]);

    try {
      const detailsPromise = api.get(`/orders/${orderId}`);
      const trackingPromise = api.get(`/orders/${orderId}/tracking`);
      
      const [detailsRes, trackingRes] = await Promise.all([detailsPromise, trackingPromise]);
      setOrderDetails(detailsRes.data);
      setOrderTracking(trackingRes.data);
    } catch (error) {
      console.error('Failed to load expanded order details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      alert('Could not download invoice. Please try again.');
    }
  };

  // Maps order status string to index for progress math
  const getStatusIndex = (status) => {
    const statuses = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered'];
    return statuses.indexOf(status);
  };

  const TIMELINE_STEPS = [
    { name: 'Placed', label: 'Order Placed' },
    { name: 'Confirmed', label: 'Confirmed' },
    { name: 'Packed', label: 'Packed' },
    { name: 'Shipped', label: 'Shipped' },
    { name: 'Out For Delivery', label: 'Out For Delivery' },
    { name: 'Delivered', label: 'Delivered' }
  ];

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-md mx-auto flex flex-col items-center">
          <Clock size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Track Your Orders</h2>
          <p className="text-gray-500 mt-2">Sign in to view your purchase invoices and monitor shipment timelines.</p>
          <Link to="/login" className="mt-6 w-full bg-amazon-orange text-white py-2.5 rounded-md font-semibold text-sm shadow hover:bg-opacity-95 text-center">
            Sign In to Your Account
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="bg-gray-200 h-8 rounded w-1/4"></div>
        <div className="bg-gray-200 h-20 rounded"></div>
        <div className="bg-gray-200 h-20 rounded"></div>
        <div className="bg-gray-200 h-20 rounded"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-gray-900 mb-8 tracking-tight">Order Tracking</h1>

      {orders.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-100 text-center shadow-sm flex flex-col items-center">
          <Package size={64} className="text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900">No Orders Found</h2>
          <p className="text-gray-500 mt-2">You haven't placed any orders yet. Head to the store and check out!</p>
          <Link to="/" className="mt-6 bg-amazon-orange text-white px-6 py-2.5 rounded-md font-semibold text-sm shadow hover:bg-opacity-95">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const currentIdx = getStatusIndex(order.order_status);

            return (
              <div key={order.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
                
                {/* Order Header Summary Row */}
                <div 
                  onClick={() => handleToggleExpand(order.id)}
                  className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isExpanded ? 'bg-gray-50/50 border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">ORDER NUMBER</p>
                      <p className="text-sm font-bold text-gray-800">#{order.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">DATE PLACED</p>
                      <p className="text-sm font-semibold text-gray-700 flex items-center space-x-1">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">TOTAL INVOICE</p>
                      <p className="text-sm font-extrabold text-amazon-orange">${parseFloat(order.total_amount).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      order.order_status === 'Delivered'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {order.order_status}
                    </span>
                    {isExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Details & Timeline */}
                {isExpanded && (
                  <div className="p-6 bg-white border-t border-gray-100 space-y-8">
                    {detailsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-amazon-orange" size={32} />
                      </div>
                    ) : orderDetails ? (
                      <>
                        {/* Download Invoice Action Card */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">Detailed Invoice Details</h4>
                            <p className="text-xs text-gray-500 mt-0.5">Generate and download official PDF receipt.</p>
                          </div>
                          <button
                            onClick={() => handleDownloadInvoice(order.id)}
                            className="bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs py-2.5 px-4 rounded border border-gray-300 shadow-sm flex items-center gap-1.5 transition active:scale-95 shrink-0"
                          >
                            <FileText size={14} className="text-gray-500" />
                            <span>Download Invoice (PDF)</span>
                          </button>
                        </div>

                        {/* 1. PROGRESS BAR & TIMELINE */}
                        <div className="space-y-4">
                          <h4 className="font-bold text-gray-900 text-sm">Delivery Tracking Progress</h4>
                          
                          {/* Timeline Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            {TIMELINE_STEPS.map((step, idx) => {
                              const stepIdx = getStatusIndex(step.name);
                              const isCompleted = stepIdx < currentIdx;
                              const isCurrent = stepIdx === currentIdx;
                              
                              let iconBg = 'bg-gray-100 border-gray-200 text-gray-400';
                              let badgeColor = '✓';
                              
                              if (isCompleted) {
                                iconBg = 'bg-green-500 border-green-500 text-white';
                                badgeColor = '✓';
                              } else if (isCurrent) {
                                iconBg = 'bg-amber-400 border-amber-400 text-white';
                                badgeColor = '🟡';
                              } else {
                                badgeColor = '⚪';
                              }

                              return (
                                <div key={step.name} className="flex flex-col items-center text-center p-3 bg-gray-50/50 rounded border border-gray-100">
                                  <span className="text-sm mb-1">{badgeColor}</span>
                                  <p className="text-xs font-bold text-gray-800">{step.label}</p>
                                  {isCurrent && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1.5">ACTIVE</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* SHIPPING DESTINATION SNAPSHOT */}
                        {orderDetails.address && (
                          <div className="border-t border-gray-100 pt-6 space-y-3">
                            <h4 className="font-bold text-gray-900 text-sm">Shipping Destination</h4>
                            <div className="bg-gray-50/50 p-5 rounded-lg border border-gray-200 max-w-md text-xs text-gray-600 space-y-1.5 relative">
                              <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-500">
                                {orderDetails.address.address_type}
                              </span>
                              <p className="font-bold text-gray-900 text-sm">{orderDetails.address.full_name}</p>
                              <p className="font-semibold text-gray-800">{orderDetails.address.phone}</p>
                              <div className="text-gray-600 mt-2">
                                <p>{orderDetails.address.address_line_1}</p>
                                {orderDetails.address.address_line_2 && <p>{orderDetails.address.address_line_2}</p>}
                                {orderDetails.address.landmark && <p className="text-[10px] text-gray-400 font-medium">Landmark: {orderDetails.address.landmark}</p>}
                                <p>{orderDetails.address.city}, {orderDetails.address.state} - <span className="font-bold text-gray-700">{orderDetails.address.pincode}</span></p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. ORDER ITEMS LIST */}
                        <div className="border-t border-gray-100 pt-6 space-y-4">
                          <h4 className="font-bold text-gray-900 text-sm">Purchased Items</h4>
                          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                            {orderDetails.items?.map((item) => (
                              <div key={item.id} className="p-4 flex items-center justify-between gap-4 bg-gray-50/30">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-white rounded border p-1 flex items-center justify-center shrink-0">
                                    <img src={item.thumbnail} alt={item.title} className="max-h-full max-w-full object-contain" />
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-sm text-gray-900 line-clamp-1">{item.title}</h5>
                                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                                  </div>
                                </div>
                                <span className="font-extrabold text-amazon-orange text-sm">
                                  ${parseFloat(item.price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. DETAILED TRACKING TIMELINE HISTORY LOGS */}
                        <div className="border-t border-gray-100 pt-6 space-y-4">
                          <h4 className="font-bold text-gray-900 text-sm">Tracking Status Logs</h4>
                          <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                            {orderTracking.map((track) => (
                              <div key={track.id} className="relative">
                                {/* Dot indicator */}
                                <div className="absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full bg-white border-2 border-amazon-orange flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-amazon-orange rounded-full"></div>
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-sm text-gray-800">{track.status}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(track.created_at).toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{track.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </>
                    ) : (
                      <p className="text-center text-red-500 text-sm">Failed to load order data.</p>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Simple loader wrapper
function Loader2({ size, className }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default Orders;
