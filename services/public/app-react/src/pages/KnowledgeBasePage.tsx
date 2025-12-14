// src/pages/KnowledgeBasePage.tsx
import React, { useEffect, useState } from 'react';
import { Database, Plus, Upload, Trash2, Eye } from 'lucide-react';
import { Collection, Job } from '../types/api';

// Asumsi tipe data Collection dan Job sudah diperbarui di types/api.ts

function mockCollections(): Collection[] {
  return [
    { id: 'c1', name: 'Product Docs', description: 'Docs about product features', document_count: 42, chunk_count: 420, updated_at: new Date().toISOString() },
    { id: 'c2', name: 'Support KB', description: 'Common support articles', document_count: 12, chunk_count: 90, updated_at: new Date().toISOString() },
  ];
}

function mockJobs(): Job[] {
  return [
    { job_id: 'j1', type: 'ingest', status: 'queued', payload: '{}', attempts: 0, created_at: new Date().toISOString() },
    { job_id: 'j2', type: 'embed', status: 'running', payload: '{}', attempts: 1, created_at: new Date().toISOString() },
    { job_id: 'j3', type: 'index', status: 'done', payload: '{}', attempts: 1, created_at: new Date().toISOString() },
    { job_id: 'j4', type: 'ingest', status: 'error', payload: '{}', attempts: 2, last_error: 'File too large', created_at: new Date().toISOString() },
  ];
}

export default function KnowledgeBasePage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    // load mock data
    setCollections(mockCollections());
    setJobs(mockJobs());
  }, []);

  function handleNewCollection(){
    alert('New collection (placeholder)');
  }

  function handleBulkUpload(){
    // dispatch event for sidebar to handle file input
    window.dispatchEvent(new CustomEvent('collections:bulk-upload'));
    alert('Ingest job queued (mock)');
    // add a queued job mock
    setJobs(j=>[{ job_id: 'j'+(j.length+1), type:'ingest', status:'queued', payload:'{}', attempts:0, created_at: new Date().toISOString() }, ...j]);
  }

  function handleViewDocs(c: Collection){
    console.log('view docs', c);
    alert('View docs for '+c.name+' (placeholder)');
  }

  function handleDelete(c: Collection){
    if(!confirm('Delete collection '+c.name+'?')) return;
    setCollections(cs=>cs.filter(x=>x.id!==c.id));
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="w-6 h-6 mr-3 text-gray-500 dark:text-purple-300" />
          <h1 className="text-2xl font-semibold text-gray-500 dark:text-white">Knowledge Base</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleNewCollection} className="inline-flex items-center px-3 py-2 rounded-md bg-purple-600 text-white shadow-sm hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4 mr-2" /> New Collection
          </button>
          {/* BUTTON: Atur border dan warna teks/background di dark mode */}
          <button onClick={handleBulkUpload} className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-500 text-gray-500 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors">
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload Files
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map(c=> (
          <div key={c.id} className="p-4 border border-gray-200 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-500 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-gray-500 dark:text-white">{c.name}</div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{c.description}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Docs: {c.document_count}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Chunks: {c.chunk_count}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={()=>handleViewDocs(c)} className="px-3 py-2 bg-purple-600 text-white rounded-md inline-flex items-center gap-2 hover:bg-purple-700 transition-colors"><Eye className="w-4 h-4"/> View Docs</button>
              <button onClick={()=>handleDelete(c)} className="px-3 py-2 bg-gray-100 dark:bg-transparent rounded-md flex items-center border border-gray-300 dark:border-gray-500 text-gray-500 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-500/50 transition-colors">
                <Trash2 className="w-4 h-4 mr-2"/> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        {/* HEADER: Wajib putih di dark mode */}
        <h2 className="text-lg font-semibold mb-3 text-gray-500 dark:text-white">Ingestion Status & Jobs</h2>
        {jobs.length === 0 ? <div className="text-gray-500 dark:text-gray-400">No jobs</div> : (
          <div className="overflow-auto bg-white dark:bg-gray-500 p-4 rounded-lg border border-gray-200 dark:border-gray-500">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-500"><th>Job ID</th><th>Type</th><th>Status</th><th>Progress</th><th>Last Error</th></tr>
              </thead>
              <tbody>
                {jobs.map(j=> (
                  <tr key={j.job_id} className="align-top border-b border-gray-100 dark:border-gray-500/50">
                    {/* TEXT UTAMA: Wajib putih di dark mode */}
                    <td className="py-2 text-sm text-gray-500 dark:text-white">{j.job_id}</td>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">{j.type}</td>
                    <td className="py-2 text-sm">
                      {/* STATUS BADGES: Sesuaikan warna BG dan teks di dark mode */}
                      {j.status === 'queued' && <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-500 dark:bg-gray-500 dark:text-gray-300">Queued</span>}
                      {j.status === 'running' && <span className="px-2 py-1 text-xs rounded-full bg-purple-500 text-white">Running</span>}
                      {j.status === 'done' && <span className="px-2 py-1 text-xs rounded-full bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-200">Done</span>}
                      {j.status === 'error' && <span className="px-2 py-1 text-xs rounded-full bg-red-200 text-red-700 dark:bg-red-700 dark:text-red-200">Error</span>}
                    </td>
                    <td className="py-2 text-sm">
                      {j.status === 'running' ? <div className="w-40 h-2 bg-gray-300 rounded dark:bg-gray-600"><div className="h-2 bg-purple-500 rounded" style={{width: '60%'}}/></div> : j.status === 'queued' ? 'Queued' : j.status === 'done' ? '100%' : j.status === 'error' ? 'Failed' : ''}
                    </td>
                    <td className="py-2 text-sm text-red-500 dark:text-red-400">{j.last_error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}