import React from 'react';

type Props = {
  appearance: 'system'|'light'|'dark';
  applyAppearance: (v: 'system'|'light'|'dark') => void;
};

export default function GeneralSettingsTab({ appearance, applyAppearance }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Appearance</div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">Choose theme preference</div>

        <div className="mt-3 flex gap-3">
          <label className={`px-3 py-2 rounded-md border ${appearance === 'system' ? 'border-gray-300 bg-gray-50' : 'border-transparent bg-white dark:bg-[#071026]'} text-sm cursor-pointer`}>
            <input type="radio" name="appearance" checked={appearance==='system'} onChange={()=>applyAppearance('system')} className="mr-2"/> System
          </label>
          <label className={`px-3 py-2 rounded-md border ${appearance === 'light' ? 'border-gray-300 bg-gray-50' : 'border-transparent bg-white dark:bg-[#071026]'} text-sm cursor-pointer`}>
            <input type="radio" name="appearance" checked={appearance==='light'} onChange={()=>applyAppearance('light')} className="mr-2"/> Light
          </label>
          <label className={`px-3 py-2 rounded-md border ${appearance === 'dark' ? 'border-gray-300 bg-gray-50 dark:bg-gray-800' : 'border-transparent bg-white dark:bg-[#071026]'} text-sm cursor-pointer`}>
            <input type="radio" name="appearance" checked={appearance==='dark'} onChange={()=>applyAppearance('dark')} className="mr-2"/> Dark
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Accent color</div>
        <div className="mt-2 flex items-center gap-2">
          <button className="w-6 h-6 rounded-full bg-purple-600" aria-label="Accent purple" />
          <button className="w-6 h-6 rounded-full bg-green-500" aria-label="Accent green" />
          <button className="w-6 h-6 rounded-full bg-gray-500" aria-label="Accent gray" />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Other</div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">Settings preview and additional options go here.</div>
      </div>
    </div>
  );
}
