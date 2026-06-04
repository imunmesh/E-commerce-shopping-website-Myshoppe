import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-amazon-blue text-gray-300 mt-auto border-t border-gray-800">
      {/* Top back to top bar */}
      <button 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-full bg-amazon-lightBlue py-3 text-center text-sm font-semibold hover:bg-opacity-95 transition-all text-white"
      >
        Back to top
      </button>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <span className="text-xl font-bold tracking-tight text-white">
            My<span className="text-amazon-yellow">Shopee</span>
          </span>
          <p className="mt-4 text-sm text-gray-400 leading-relaxed">
            MyShopee is a premium e-commerce platform offering an extensive selection of products, secure Stripe checkouts, dynamic order tracking, and real-time email shipping confirmations.
          </p>
        </div>
        
        <div>
          <h3 className="text-white font-semibold mb-4 text-lg">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:underline hover:text-white">Shop Browse</Link></li>
            <li><Link to="/cart" className="hover:underline hover:text-white">Shopping Cart</Link></li>
            <li><Link to="/wishlist" className="hover:underline hover:text-white">Your Wishlist</Link></li>
            <li><Link to="/orders" className="hover:underline hover:text-white">Track Order</Link></li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-white font-semibold mb-4 text-lg">Contact & Tech</h3>
          <p className="text-sm text-gray-400">
            Powered by Neon PostgreSQL, Express, React, Stripe Payments, Cloudinary Media, and Brevo SMTP.<br/><br/>
            Email Support: unmeshbhangale41@gmail.com
          </p>
        </div>
      </div>

      {/* Copyrights */}
      <div className="bg-black py-4 border-t border-gray-900 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} MyShopee. Inspired by Amazon. Built as a production-ready application.
      </div>
    </footer>
  );
};

export default Footer;
