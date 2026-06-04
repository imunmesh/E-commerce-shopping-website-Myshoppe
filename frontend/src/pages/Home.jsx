import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import ProductCard from '../components/ProductCard';
import SidebarFilters from '../components/SidebarFilters';
import { RefreshCw } from 'lucide-react';

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamQuery = searchParams.get('search') || '';

  const [products, setProducts] = useState([]);
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    minPrice: '',
    maxPrice: ''
  });

  // Keep search inputs and query values in sync
  useEffect(() => {
    fetchProducts();
  }, [searchParams, filters, sort, order, pagination.currentPage]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentlyViewed();
    }
  }, [isAuthenticated]);

  const fetchRecentlyViewed = async () => {
    try {
      const res = await api.get('/products/recently-viewed');
      setRecentlyViewed(res.data);
    } catch (err) {
      console.error('Failed to fetch recently viewed:', err);
    }
  };

  // Handle URL search param overrides
  useEffect(() => {
    if (searchParamQuery) {
      setFilters(prev => ({ ...prev, search: searchParamQuery }));
    }
  }, [searchParamQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.currentPage,
        limit: 8,
        sort,
        order,
        ...filters,
        search: searchParamQuery // overrides standard search if URL has it
      });

      const response = await api.get(`/products?${queryParams.toString()}`);
      setProducts(response.data.products);
      setPagination({
        currentPage: response.data.pagination.currentPage,
        totalPages: response.data.pagination.totalPages
      });
    } catch (error) {
      console.error('Failed to load products list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // reset page
  };

  const handleResetFilters = () => {
    setFilters({
      category: '',
      brand: '',
      minPrice: '',
      maxPrice: ''
    });
    setSearchParams({}); // clear search query
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    if (value === 'price_asc') {
      setSort('price');
      setOrder('asc');
    } else if (value === 'price_desc') {
      setSort('price');
      setOrder('desc');
    } else if (value === 'rating') {
      setSort('rating');
      setOrder('desc');
    } else {
      setSort('created_at');
      setOrder('desc');
    }
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Premium Hero Banner */}
      <div className="relative bg-gradient-to-r from-amazon-blue to-amazon-lightBlue text-white py-12 px-6 overflow-hidden mb-8 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between relative z-10">
          <div className="mb-6 md:mb-0 text-center md:text-left">
            <span className="text-amazon-yellow font-black text-sm uppercase tracking-widest bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">Summer Deal Days</span>
            <h1 className="text-4xl md:text-5xl font-extrabold mt-3 tracking-tight font-sans">
              Discover Premium Products<br/>At Low Prices
            </h1>
            <p className="mt-3 text-gray-300 max-w-lg">
              Explore our curated selection. Save up to 50% with free shipping, Stripe secure transactions, and instant tracking confirmation.
            </p>
          </div>
          <div className="hidden lg:block shrink-0">
            <img 
              src="https://img.icons8.com/illustrations/external-kiranshastry-solid-kiranshastry/150/external-shopping-bag-ecommerce-kiranshastry-solid-kiranshastry.png" 
              alt="Hero bag illustration" 
              className="w-48 h-48 drop-shadow-[0_10px_20px_rgba(254,189,105,0.25)] animate-bounce"
              style={{ animationDuration: '3s' }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Filters Column */}
          <SidebarFilters 
            filters={filters} 
            onFilterChange={handleFilterChange} 
            onReset={handleResetFilters} 
          />

          {/* Listing Column */}
          <div className="flex-1">
            
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-500">
                  Showing <span className="text-gray-900 font-bold">{products.length}</span> results
                  {searchParamQuery && ` for "${searchParamQuery}"`}
                </p>
              </div>
              
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-sm text-gray-500 font-medium">Sort by:</span>
                <select
                  onChange={handleSortChange}
                  className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-md py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-amazon-yellow text-gray-800"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Customer Rating</option>
                </select>
              </div>
            </div>

            {/* Grid display */}
            {loading ? (
              // Skeleton loading simulation
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                  <div key={item} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm animate-pulse space-y-3">
                    <div className="bg-gray-200 aspect-square w-full rounded"></div>
                    <div className="bg-gray-200 h-4 rounded w-3/4"></div>
                    <div className="bg-gray-200 h-4 rounded w-1/2"></div>
                    <div className="bg-gray-200 h-6 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center">
                <img 
                  src="https://img.icons8.com/bubbles/100/search.png" 
                  alt="No search results" 
                  className="w-24 h-24 mb-4"
                />
                <h3 className="text-xl font-bold text-gray-900">No Products Found</h3>
                <p className="text-gray-500 mt-2 max-w-sm">
                  We couldn't find any products matching your current filters or search terms. Try clearing filters or resetting.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-6 bg-amazon-orange text-white px-6 py-2 rounded-md font-semibold text-sm shadow hover:bg-opacity-95"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-10">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={pagination.currentPage === 1}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-semibold bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
                >
                  Previous
                </button>
                
                {Array.from({ length: pagination.totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: idx + 1 }))}
                    className={`px-3.5 py-2 rounded-md text-sm font-bold transition duration-150 ${
                      pagination.currentPage === idx + 1
                        ? 'bg-amazon-orange text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-semibold bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
                >
                  Next
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Recently Viewed Carousel */}
        {isAuthenticated && recentlyViewed.length > 0 && (
          <div className="mt-12 bg-white p-6 rounded-xl border border-gray-150 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-6">
              You Recently Viewed
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {recentlyViewed.slice(0, 6).map((prod) => {
                const discPrice = parseFloat(prod.price) * (1 - (prod.discount || 0) / 100);
                const imagesList = Array.isArray(prod.images) ? prod.images : [];
                const primaryImage = imagesList.find(img => img.is_primary === true) || imagesList[0];
                const thumbnail = primaryImage
                  ? (typeof primaryImage === 'string' ? primaryImage : primaryImage.image_url)
                  : 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100';
                return (
                  <Link
                    key={prod.id}
                    to={`/product/${prod.id}`}
                    className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:shadow-md hover:border-amazon-orange transition group"
                  >
                    <div className="w-full aspect-square bg-gray-50 flex items-center justify-center p-1.5 rounded mb-2 overflow-hidden">
                      <img
                        src={thumbnail}
                        alt={prod.title}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <h4 className="font-bold text-xs text-gray-800 line-clamp-1 w-full text-center group-hover:text-amazon-orange transition-colors">
                      {prod.title}
                    </h4>
                    <span className="font-black text-amazon-orange text-xs mt-1">
                      ${discPrice.toFixed(2)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Home;
