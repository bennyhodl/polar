#!/bin/sh
set -e

# containers on linux share file permissions with hosts.
# assigning the same uid/gid from the host user
# ensures that the files can be read/write from both sides
if ! id lnd > /dev/null 2>&1; then
  USERID=${USERID:-1000}
  GROUPID=${GROUPID:-1000}

  echo "adding user sensei ($USERID:$GROUPID)"
  groupadd -f -g $GROUPID lnd
  useradd -r -u $USERID -g $GROUPID sensei
  chown -R $USERID:$GROUPID /home/sensei
fi

if [ $(echo "$1" | cut -c1) = "-" ]; then
  echo "$0: assuming arguments for sensei"

  set -- senseid "$@"
fi

if [ "$1" = "senseid" ]; then
  echo "Running as sensei user: $@"
  exec su - senseid "$@"
fi

echo "$@"
exec "$@"
