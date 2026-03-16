#!/bin/bash
ENVFILE=/root/services/FinalYear/.env

update_env() {
  KEY=$1
  VAL=$2
  if grep -q "^${KEY}=" "$ENVFILE"; then
    sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" "$ENVFILE"
  else
    echo "${KEY}=${VAL}" >> "$ENVFILE"
  fi
  echo "Set: ${KEY}"
}

update_env PAYPAL_CLIENT_ID "AY3mMP6uk3hUhgtYcKjaKBS8P9_D1EmlwoP_w8fpwQvW0RoslkLDHy9jd-eNLv5ITIntlsMuM3jNAheE"
update_env PAYPAL_SECRET "ENGDcU4ELnIMigExAGech5Cy_9viOm5jpvjWEi3I8q6EB9raHSJsENzvmikbeBoS3D1aXhXIOSdCITan"
update_env PAYPAL_MODE "sandbox"
update_env ESCROW_CONTRACT_LOCALHOST "0x5FbDB2315678afecb367f032d93F642f64180aa3"
update_env ESCROW_CONTRACT_POLYGON_AMOY "0xCDE08Be0190482691b3288C27240378497d74E79"

echo ""
echo "=== Final values ==="
grep -E "PAYPAL_CLIENT_ID|PAYPAL_SECRET|PAYPAL_MODE|ESCROW_CONTRACT_LOCALHOST|ESCROW_CONTRACT_POLYGON_AMOY" "$ENVFILE"
