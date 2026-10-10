import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
const s3 = new S3Client({ region: 'auto', endpoint: `https://${acc}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
for (const name of process.argv.slice(2)) {
    try { await s3.send(new HeadBucketCommand({ Bucket: name })); console.log(`TAKEN ${name}`); continue; }
    catch (e) { const c = e.$metadata?.httpStatusCode; if (c !== 404 && e.name !== 'NotFound') { console.log(`HEAD ${name} -> ${c} ${e.name} (not creating)`); continue; } }
    try { await s3.send(new CreateBucketCommand({ Bucket: name })); console.log(`CREATED ${name}`); break; }
    catch (e) { console.log(`CREATE ${name} failed: ${e.name} ${e.$metadata?.httpStatusCode} ${e.message}`); }
}
