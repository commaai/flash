output=$(pip list | grep pyusb)
installed="false"
if [[ "$output" == *"pyusb"* ]]; then
  installed="true"
fi

if [[ "$installed" == "false" ]]; then
  pip install pyusb==1.2.1
fi

curl -o- https://raw.githubusercontent.com/bongbui321/flash/qdl/scripts/detach_driver.py | python3

if [[ "$installed" == "false" ]]; then
  pip uninstall -y pyusb==1.2.1
fi