// Read-only provider probe. Requires explicit isolated staging configuration; sends no funds.
import 'reflect-metadata';
import {TronHttpProvider} from '../dist/modules/blockchain/providers/tron-http.provider.js';
if(process.env.DEPLOYMENT_ENV!=='staging'||!['tron-shasta','tron-nile'].includes(process.env.TRON_NETWORK)||process.env.TRON_PROVIDER!=='tron-http')throw new Error('Explicit test-network staging configuration required');
if(!process.env.TRON_API_KEY||!process.env.TRON_USDT_CONTRACT||!process.env.TRON_VALIDATION_TX_HASH)throw new Error('Provider key, configured test token contract and known fixture transaction required');
try{const p=new TronHttpProvider();const head=await p.getLatestBlock();const tx=await p.getTransaction(process.env.TRON_VALIDATION_TX_HASH);if(!tx||!tx.canonical||tx.execution!=='SUCCESS')throw new Error();
 const transfers=await p.getTokenTransferDetails(process.env.TRON_VALIDATION_TX_HASH);if(!transfers.some(t=>p.checkUsdtContract(t.contract)))throw new Error();
 console.log(JSON.stringify({status:'CONNECTED',network:process.env.TRON_NETWORK,blockHeight:head.toString(),knownTransferFound:true,financialActions:0,remaining:['controlled rate-limit and timeout fault tests','mainnet contract configuration review','independent provider acceptance approval']}));
}catch{console.error(JSON.stringify({status:'BLOCKED',reason:'PROVIDER_VALIDATION_FAILED'}));process.exitCode=1;}
