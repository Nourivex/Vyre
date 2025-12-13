import { embedText } from '../embeddings/adapter_ollama';

async function main(){
  const model = process.env.OLLAMA_MODEL || 'gemma3:4b';
  console.log('Testing embed for model', model);
  const v = await embedText('Halo Vyre, ini test embedding', 512, model);
  console.log('len', v.length, 'preview', v.slice(0,8));
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(1) });
