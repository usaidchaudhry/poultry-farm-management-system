import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
export async function testTls(root) {
  const secret = randomBytes(24).toString('hex');
  if (process.platform === 'win32') {
    const script = join(root, 'test-certificate.ps1'); const output = join(root, 'test-certificate.pfx');
    await writeFile(script, `param([string]$OutputPath,[string]$Password)
$rsa = [System.Security.Cryptography.RSACryptoServiceProvider]::new(2048)
$rsa.PersistKeyInCsp = $false
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$names = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$names.AddDnsName('localhost')
$names.AddIpAddress([System.Net.IPAddress]::Parse('127.0.0.1'))
$request.CertificateExtensions.Add($names.Build())
$certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(1))
[System.IO.File]::WriteAllBytes($OutputPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $Password))
$certificate.Dispose()
$rsa.Dispose()
`, { mode: 0o600 });
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-OutputPath', output, '-Password', secret], { windowsHide: true, stdio: 'pipe' });
    const pfx = await readFile(output); await unlink(output); await unlink(script); return { pfx, passphrase: secret };
  }
  const key = join(root, 'test-key.pem'); const cert = join(root, 'test-cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'pipe' });
  const options = { key: await readFile(key), cert: await readFile(cert) }; await unlink(key); await unlink(cert); return options;
}
