# Kubectl Setup for Swiss K8s Cluster

## Get Kubeconfig from Exoscale

### Option 1: Exoscale CLI

```bash
# Install Exoscale CLI if not already installed
brew install exoscale/tap/exoscale-cli

# Login to Exoscale
exo auth login

# Get kubeconfig for your cluster
exo compute sks kubeconfig <cluster-name> admin --zone ch-gva-2 > ~/.kube/swiss-k8s-config

# Set KUBECONFIG environment variable
export KUBECONFIG=~/.kube/swiss-k8s-config

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Option 2: Exoscale Web Console

1. Go to https://portal.exoscale.com/
2. Navigate to: **Compute** → **Kubernetes**
3. Select your cluster in **ch-gva-2** zone
4. Click **"Download Kubeconfig"** button
5. Save the file to `~/.kube/swiss-k8s-config`
6. Set environment variable:
   ```bash
   export KUBECONFIG=~/.kube/swiss-k8s-config
   kubectl cluster-info
   ```

### Option 3: Merge with Existing Config

If you have other clusters configured:

```bash
# Backup existing config
cp ~/.kube/config ~/.kube/config.backup

# Download new config to temp location
# (via CLI or web console)

# Merge configs
KUBECONFIG=~/.kube/config:~/.kube/swiss-k8s-config kubectl config view --flatten > ~/.kube/merged-config
mv ~/.kube/merged-config ~/.kube/config

# Switch context
kubectl config use-context <swiss-cluster-context-name>
kubectl config get-contexts
```

## Verify Setup

```bash
# Check current context
kubectl config current-context

# Check cluster info
kubectl cluster-info

# List nodes
kubectl get nodes

# Check if you have admin access
kubectl auth can-i create deployments --all-namespaces
# Should return: yes
```

## Set Default Context (Optional)

```bash
# Always use Swiss cluster
kubectl config use-context <swiss-cluster-context-name>
```

## Troubleshooting

### "connection refused"
- Check if kubeconfig is loaded: `echo $KUBECONFIG`
- Verify cluster endpoint: `kubectl config view --minify`
- Check VPN/network access if cluster is private

### "Unauthorized"
- Kubeconfig might be expired
- Re-download from Exoscale portal
- Check if you have correct permissions in Exoscale IAM

### "Unable to connect to the server"
- Check DNS resolution
- Verify firewall rules
- Ensure cluster is running in Exoscale console

## Next Steps

Once kubectl is configured, return to deployment:

```bash
cd /Users/malena/swiss-ai-vault/agent-api
./setup-secrets.sh
./deploy.sh
```
