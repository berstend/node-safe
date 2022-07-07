#!/usr/bin/env bash
# Shell integration for node-safe
# We generate shims for node, npm, npx, yarn and prefix the $PATH to point to them

# Set this to true (here or before sourcing this file) to disable this script
# Restart your terminal session for changes to have an effect
: "${NODE_SAFE_DISABLE_SHELL_INTEGRATION:=false}"
[[ "$NODE_SAFE_DISABLE_SHELL_INTEGRATION" != "false" ]] && return

# Make sure we only augment the PATH once
[[ -n "$NODE_SAFE_ENV_INVOKED" ]] && return
export NODE_SAFE_ENV_INVOKED=true

# All supported node-safe products to be augmented
declare -a products=("node" "npm" "npx" "yarn")
NS_NPM_PACKAGE="@berstend/node-safe"
NS_ISSUE_URL="https://github.com/berstend/node-safe/issues"

# No disk access needed when we already get told which directory this is
if [[ -z "$NODE_SAFE_DIR" ]]; then
  # Get the absolute path to the directory containing this file
  CURRENT_FILE="$( dirname -- "${BASH_SOURCE[0]}" )"
  CURRENT_DIR="$( cd -- "${CURRENT_FILE}" &> /dev/null && pwd )"
else
  CURRENT_DIR="$NODE_SAFE_DIR"
fi

# Create bin sub directory if it doesn't exist already
mkdir -p "${CURRENT_DIR}/bin"
[[ ! -d "${CURRENT_DIR}/bin" ]] && echo "Unable to create ${CURRENT_DIR}/bin" && return

# Define a template we use for the shims (the string `placeholder` gets replaced)
read -r -d '' template <<- EOM
#!/usr/bin/env bash
# This is a pseudo placeholder binary courtesy of node-safe
# https://github.com/berstend/node-safe#readme

ALREADY_INVOKED="\$NODE_SAFE_INVOKED"
export NODE_SAFE_INVOKED=true
export NODE_SAFE_IMPLICIT_LAUNCH=true
export NODE_SAFE_PRODUCT="placeholder"
export NODE_SAFE_BIN_DIR="$CURRENT_DIR/bin"

[[ -n "\$NODE_SAFE_DEBUG_SANDBOX" ]] && echo "node-safe (shell): shim for placeholder called (dir: \${NODE_SAFE_BIN_DIR})"

# Helper: Fast way to find the path to the real node binary by checking the other $PATH entries
get_vanilla_node_from_path() (
  local ignoreDir="\$1"
  while IFS=: read -d: -r path; do
    # Ignore this very directory in case it's found in the PATH
    if [[ "\$path" == "\$ignoreDir" ]]; then
      continue
    fi
    # Test each directory in the path for a node binary
    if [[ -f "\$path/node" ]]; then
        echo "\$path/node"
        break
    fi
  done <<< "\${PATH:+"\${PATH}:"}"
)

# Helper: Fast way to derive the path to other global node_module binaries from the node path
get_vanilla_product_path() (
  local str="\$1"
	local old="bin/node"
	local new="bin/\${2}"
	echo \${str/\$old/\$new}
)

# Find the path to the vanilla node binary
if [[ -z "\$NODE_SAFE_VANILLA_NODE_PATH" ]]; then
  # nvm can change the path of the node binary om the fly, hence it takes precedence if set
  [[ -n "\$NVM_BIN" ]] && NODE_SAFE_VANILLA_NODE_PATH="\$NVM_BIN/node"
  if command -v asdf > /dev/null && [[ -n "\$ASDF_DIR" ]]; then
    [[ -n "\$NODE_SAFE_DEBUG_SANDBOX" ]] && echo "node-safe (shell): getting node path from asdf"
    NODE_SAFE_VANILLA_NODE_PATH="\$(asdf which node)"
  fi
fi
if [[ -z "\$NODE_SAFE_VANILLA_NODE_PATH" ]]; then
  # get the vanilla node from the other PATH entries, ignoring our own directory
  NODE_SAFE_VANILLA_NODE_PATH="\$(get_vanilla_node_from_path \$NODE_SAFE_BIN_DIR)"
fi
if [[ -z "\$NODE_SAFE_VANILLA_NODE_PATH" ]]; then
  echo "Unable to find the real node binary. :-("
  echo "If you're certain node is installed correctly please report this issue: ${NS_ISSUE_URL}"
  echo "In the meantime (apologies for the inconvenience) disable shell integration at ${CURRENT_DIR}"
  exit 1
fi
export NODE_SAFE_VANILLA_NODE_PATH="\$NODE_SAFE_VANILLA_NODE_PATH"

# Derive other paths from the vanilla node path
export NODE_SAFE_VANILLA_PRODUCT_PATH="\$(get_vanilla_product_path \$NODE_SAFE_VANILLA_NODE_PATH \$NODE_SAFE_PRODUCT)"
export NODE_SAFE_PATH="\$(get_vanilla_product_path \$NODE_SAFE_VANILLA_NODE_PATH node-safe)"

# We only need to sandbox a given invocation once
if [[ -n "\$ALREADY_INVOKED" ]]; then
  [[ -n "\$NODE_SAFE_DEBUG_SANDBOX" ]] && echo "node-safe (shell): skipping sandbox for \NODE_SAFE_PRODUCT (we're already sandboxed)"
  [[ "\$NODE_SAFE_VANILLA_NODE_PATH" != "\$NODE_SAFE_VANILLA_PRODUCT_PATH" ]] && exec \$NODE_SAFE_VANILLA_NODE_PATH \$NODE_SAFE_VANILLA_PRODUCT_PATH "\$@"
  [[ "\$NODE_SAFE_VANILLA_NODE_PATH" == "\$NODE_SAFE_VANILLA_PRODUCT_PATH" ]] && exec \$NODE_SAFE_VANILLA_NODE_PATH "\$@"
fi

# Check if the node-safe binary exists
if [ ! -f \$NODE_SAFE_PATH ]; then
  # Install node-safe globally if missing for ultimate convenience (can happen when nvm switches node versions)
  VANILLA_NPM_PATH="\$(get_vanilla_product_path \$NODE_SAFE_VANILLA_NODE_PATH npm)"
  echo "node-safe not found (checked at: \$NODE_SAFE_PATH)"
  echo "running \$VANILLA_NPM_PATH install --global ${NS_NPM_PACKAGE}"
  \$NODE_SAFE_VANILLA_NODE_PATH \$VANILLA_NPM_PATH install --global ${NS_NPM_PACKAGE}
fi
if [ ! -f \$NODE_SAFE_PATH ]; then
  echo "Apologies, unable to find or install node-safe. :-("
  echo "We're expecting it to be here but it's not: \$NODE_SAFE_PATH "
  echo "Please report this issue: ${NS_ISSUE_URL}"
  echo "For the time being disable shell integration at ${CURRENT_DIR}"
  exit 1
fi

# Check if this has been invoked by running a -safe command and we're used as an interpreter
# The -safe commands use `#!/usr/bin/env node` so we can save an extra hop here
# My bash skills are not good enough to use the product array here lol
if [[ "\$NODE_SAFE_PRODUCT" == "node" && -n "\$1" ]]; then
  [[ -n "\$NODE_SAFE_DEBUG_SANDBOX" ]] && echo "node-safe (shell): invoking \$NODE_SAFE_VANILLA_NODE_PATH \$@"
  if [[ "\$1" == *"bin/node-safe"* || "\$1" == *"bin/npm-safe"*  || "\$1" == *"bin/npx-safe"* || "\$1" == *"bin/yarn-safe"* ]]; then
    exec \$NODE_SAFE_VANILLA_NODE_PATH "\$@"
  fi
fi

# Replace this session with node-safe
[[ -n "\$NODE_SAFE_DEBUG_SANDBOX" ]] && echo "node-safe (shell): invoking \$NODE_SAFE_VANILLA_NODE_PATH \$NODE_SAFE_PATH \$@"
exec \$NODE_SAFE_VANILLA_NODE_PATH \$NODE_SAFE_PATH "\$@"
EOM

# Loop over products and create shims
for product in "${products[@]}"
do
  # Use the template and replace all occurences of the placeholder string
  content="${template//placeholder/$product}"
  # Add script to ./bin/ and make executable
  echo "$content" > "${CURRENT_DIR}/bin/${product}"
  chmod +x "${CURRENT_DIR}/bin/${product}"
done

# Store reference to the original node binary for faster lookups later
if command -v asdf > /dev/null && [[ -n "$ASDF_DIR" ]]; then
  NODE_SAFE_VANILLA_NODE_PATH=$(asdf which node)
else
  NODE_SAFE_VANILLA_NODE_PATH=$(which node)
fi
export NODE_SAFE_VANILLA_NODE_PATH
[[ -z "$NODE_SAFE_DIR" ]] && export NODE_SAFE_DIR="$CURRENT_DIR"

# Prepend the path with our bin directory so we get called when e.g. node is executed
export PATH="${CURRENT_DIR}/bin:$PATH"
