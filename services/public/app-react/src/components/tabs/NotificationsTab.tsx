import React from 'react';

export default function NotificationsTab() {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Notifications</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">Configure notification preferences and channels.</div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="form-checkbox" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Email notifications</span>
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" className="form-checkbox" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Desktop push notifications</span>
        </label>
      </div>
    </div>
  );
}
