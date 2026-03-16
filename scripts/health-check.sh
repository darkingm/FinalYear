#!/bin/bash
echo "=== External API Test ==="
curl -s https://kienai.id.vn/api/health 2>/dev/null | head -c 150 || echo "FAIL"
echo ""
curl -s https://kienai.id.vn/payment/health 2>/dev/null | head -c 150 || echo "FAIL"
echo ""

echo "=== Internal port test ==="
curl -s http://localhost:3001/health 2>/dev/null | head -c 150 || echo "3001/health:FAIL"
echo ""
curl -s http://localhost:3002/health 2>/dev/null | head -c 150 || echo "3002/health:FAIL"
echo ""

echo "=== Done ==="
