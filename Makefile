.PHONY: require-% install-statik install

# Installs statik.
install-statik:
	go get -u github.com/rakyll/statik

# installs demo-taxi binary in $GOPATH/bin
install: require-go require-statik
	go generate
	go install


## COMMON (go)

# Set up vendor directory using `dep`
vendor: Gopkg.toml require-dep
	dep ensure -vendor-only
	touch vendor

# Prints instructions for installing go
install-go:
	@echo "Will not install Go automatically. Follow instructions at https://golang.org/doc/install"


## COMMON

require-%:
	$(if $(shell which $* 2>/dev/null),\
		$(info Verified build dependency "$*" is installed.),\
		$(error Build dependency "$*" not installed. To install, try `make install-$*`))

