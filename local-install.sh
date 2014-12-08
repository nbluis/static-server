rm -f static-server-*.tgz
npm pack
npm -g uninstall static-server
npm -g install static-server-*.tgz