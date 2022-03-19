import React, { useState } from 'react';

export default function TokenIcon({ mint, url, tokenName, size = 20 }) {
  const [hasError, setHasError] = useState(false);

  if (!url && mint === null) {
    url = 'https://media.discordapp.net/attachments/918655571694080020/918655663838736394/solvia-icon-bg.png';
  }

  if (hasError || !url) {
    return null;
  }

  return (
    <img
      src={url}
      title={tokenName}
      alt={tokenName}
      style={{
        width: size,
        height: size,
        backgroundColor: 'white',
        borderRadius: size / 2,
      }}
      onError={() => setHasError(true)}
    />
  );
}
