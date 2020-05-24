import * as crypto from 'crypto';

/**
 * Decrypt the supplied data. 
 * @param encryptedData the data to decrypt
 * @param apiKey the API key for the device the encrypted data is for
 * @param iv the initialisation vector associated with the encrypted message. 
 */
export function decrypt(encryptedData: string, apiKey: string, iv: string): string {

  /* Documentation from SonoffCryto class
     XXX add link

    Here are an abstract of the old document

        The default password must be the API Key of the device.

        The key used for encryption is the MD5 hash
         of the device password (16 bytes)

        The initialization vector iv used for encryption
        is a 16-byte random number, Base64 encoded as a string

        The encryption algorithm must be "AES-128-CBC/PKCS7Padding"
        (AES 128 Cipher Block Chaining (CBC) with PKCS7 Padding)

    */

  /* This bit caused me many issues and misunderstandings,
       do this incorrectly, or handle the digest conversion to
       a hex string at this point (instead of a buffer), and
       later steps will interpret this as a 32 byte key instead
       of 16 (the correct answer). This led me to incorrectly 
       interpret this as aes-256 encryption (as the python code 
       uses the key to determine the correct cipher). Only on 
       finding the comment above did I realise the decyption 
       issues were down to the wrong encryption algorithm, as
       opposed to anything else. 
    */
  const cryptkey = crypto.createHash('md5')
    .update(Buffer.from(apiKey, 'utf8'))
    .digest();

  const ivBuffer = Buffer.from(iv, 'base64');

  const cipherText = Buffer.from(encryptedData, 'base64');
  
  
  const decipher = crypto.createDecipheriv('aes-128-cbc', cryptkey, ivBuffer);

  const plainText = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return plainText.toString('utf8');
}

export function encrypt(plainText: string, apiKey: string) {

  const cryptkey = crypto.createHash('md5')
    .update(Buffer.from(apiKey, 'utf8'))
    .digest();

  const iv = crypto.randomBytes(16);

  const encipher = crypto.createCipheriv('aes-128-cbc', cryptkey, iv);

  const cipherText = Buffer.concat([
    encipher.update(plainText),
    encipher.final(),
  ]);

  return {
    data: cipherText,
    iv: iv,
  };

}