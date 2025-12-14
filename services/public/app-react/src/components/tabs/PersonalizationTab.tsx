import React from 'react';

export default function PersonalizationTab() {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Personalization</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">Tweak how your app looks and behaves for you.</div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="form-checkbox" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show compact lists</span>
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" className="form-checkbox" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Enable experimental UI</span>
        </label>
      </div>
    </div>
  );
}
