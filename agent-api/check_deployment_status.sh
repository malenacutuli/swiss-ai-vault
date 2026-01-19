#!/bin/bash
# Check deployment status and image

echo "=== Deployment Status ==="
kubectl get deployment agent-worker -n agents -o wide

echo ""
echo "=== Deployment Image ==="
kubectl get deployment agent-worker -n agents -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo ""
echo "=== Deployment Command ==="
kubectl get deployment agent-worker -n agents -o jsonpath='{.spec.template.spec.containers[0].command}'
echo ""

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker -o wide

echo ""
echo "=== Pod Image (actual running) ==="
kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

echo ""
echo "=== Pod Command (actual running) ==="
kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].command}'
echo ""

echo ""
echo "=== Rollout History ==="
kubectl rollout history deployment/agent-worker -n agents

echo ""
echo "=== Recent Pod Creation Time ==="
kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.creationTimestamp}'
echo ""
