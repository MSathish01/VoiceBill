import React from 'react';
import { UserDetails, Translation } from '../types';

interface CustomerFormProps {
  details: UserDetails;
  onChange: (details: UserDetails) => void;
  t: Translation;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ details, onChange, t }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ ...details, [name]: value });
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
        <i className="fas fa-user mr-2 text-secondary"></i>
        {t.userDetails}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.namePlaceholder}</label>
            <input
            type="text"
            name="name"
            value={details.name}
            onChange={handleChange}
            placeholder={t.namePlaceholder}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.mobilePlaceholder}</label>
            <input
            type="tel"
            name="mobile"
            value={details.mobile}
            onChange={handleChange}
            placeholder={t.mobilePlaceholder}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            />
        </div>
        <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.addressPlaceholder}</label>
            <input
            type="text"
            name="address"
            value={details.address}
            onChange={handleChange}
            placeholder={t.addressPlaceholder}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            />
        </div>
        <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">{t.emailPlaceholder}</label>
            <input
            type="email"
            name="email"
            value={details.email}
            onChange={handleChange}
            placeholder={t.emailPlaceholder}
            className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            />
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;
