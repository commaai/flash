import React from 'react';
import Flash from './Flash.js';

export default function App(props) {
  const version = props.version || 'dev';

  return React.createElement(
    'div',
    { className: 'flex flex-col lg:flex-row flex-wrap' },
    React.createElement(
      'main',
      {
        className:
          'p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900',
      },
      React.createElement(
        'section',
        null,
        React.createElement('img', {
          src: 'src/assets/comma.svg',
          alt: 'comma',
          width: 128,
          height: 128,
          className: 'dark:invert',
        }),
        React.createElement('h1', null, 'flash.comma.ai'),
        React.createElement(
          'p',
          null,
          'This tool allows you to flash AGNOS onto your comma device.'
        ),
        React.createElement(
          'p',
          null,
          'AGNOS is the Ubuntu-based operating system for your ',
          React.createElement(
            'a',
            {
              href: 'https://comma.ai/shop/comma-3x',
              target: '_blank',
            },
            'comma 3/3X'
          ),
          '.'
        )
      ),
      React.createElement('hr'),
      React.createElement(
        'section',
        null,
        React.createElement('h2', null, 'Requirements'),
        React.createElement(
          'ul',
          null,
          React.createElement(
            'li',
            null,
            'A web browser which supports WebUSB (such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.'
          ),
          React.createElement(
            'li',
            null,
            'A USB-C cable to power your device outside the car.'
          ),
          React.createElement(
            'li',
            null,
            'Another USB-C cable to connect the device to your computer.'
          )
        ),
        React.createElement('h3', null, 'USB Driver'),
        React.createElement(
          'p',
          null,
          'You need additional driver software for Windows before you connect your device.'
        ),
        React.createElement(
          'ol',
          null,
          React.createElement(
            'li',
            null,
            'Download and install ',
            React.createElement(
              'a',
              { href: 'https://zadig.akeo.ie/' },
              'Zadig'
            ),
            '.'
          ),
          React.createElement(
            'li',
            null,
            'Under ',
            React.createElement('code', null, 'Device'),
            ' in the menu bar, select ',
            React.createElement('code', null, 'Create New Device'),
            '.',
            React.createElement('img', {
              src: 'src/assets/zadig_create_new_device.png',
              alt: 'Zadig Create New Device',
              width: 575,
              height: 254,
            })
          ),
          React.createElement(
            'li',
            null,
            'Fill in three fields. The first field is just a description and you can fill in anything. The next two fields are very important. Fill them in with ',
            React.createElement('code', null, '05C6'),
            ' and ',
            React.createElement('code', null, '9008'),
            ' respectively. Press "Install Driver" and give it a few minutes to install.',
            React.createElement('img', {
              src: 'src/assets/zadig_form.png',
              alt: 'Zadig Form',
              width: 575,
              height: 254,
            })
          )
        ),
        React.createElement(
          'p',
          null,
          'No additional software is required for macOS or Linux.'
        )
      ),
      React.createElement('hr'),
      React.createElement(
        'section',
        null,
        React.createElement('h2', null, 'QDL Mode'),
        React.createElement(
          'p',
          null,
          'Follow these steps to put your device into QDL mode:'
        ),
        React.createElement(
          'ol',
          null,
          React.createElement(
            'li',
            null,
            'Power off the device and wait for the LEDs to switch off.'
          ),
          React.createElement(
            'li',
            null,
            'Connect the device to your computer using the USB-C port ',
            React.createElement('strong', null, '(port 2)'),
            '.'
          ),
          React.createElement(
            'li',
            null,
            'Connect power to the OBD-C port ',
            React.createElement('strong', null, '(port 1)'),
            '.'
          ),
          React.createElement(
            'li',
            null,
            'The device then should be visible as an option when choosing the device to flash'
          )
        ),
        React.createElement('img', {
          src: 'src/assets/fastboot-ports.svg',
          alt: 'image showing comma three and two ports. the upper port is labeled 1. the lower port is labeled 2.',
          width: 450,
          height: 300,
        })
      ),
      React.createElement('hr'),
      React.createElement(
        'section',
        null,
        React.createElement('h2', null, 'Flashing'),
        React.createElement(
          'p',
          null,
          'After your device is in QDL mode, you can click the button to start flashing. A prompt may appear to select a device; choose the device starts with ',
          React.createElement('code', null, 'QUSB_BULK'),
          '.'
        ),
        React.createElement(
          'p',
          null,
          'The process can take 30+ minutes depending on your internet connection and system performance. Do not unplug the device until all steps are complete.'
        )
      ),
      React.createElement('hr'),
      React.createElement(
        'section',
        null,
        React.createElement('h2', null, 'Troubleshooting'),
        React.createElement('h3', null, 'Too slow'),
        React.createElement(
          'p',
          null,
          'It is recommended that you use a USB 3.0 cable when flashing since it will speed up the flashing time by a lot.'
        ),
        React.createElement('h3', null, 'Cannot enter QDL'),
        React.createElement(
          'p',
          null,
          "Try using a different USB cable or USB port. Sometimes USB 2.0 ports work better than USB 3.0 (blue) ports. If you're using a USB hub, try connecting the device directly to your computer, or alternatively use a USB hub between your computer and the device."
        ),
        React.createElement('h3', null, "My device's screen is blank"),
        React.createElement(
          'p',
          null,
          'The device screen will be blank in QDL mode, but you can verify that it is in QDL if the device shows up when you press the Flash icon.'
        ),
        React.createElement(
          'h3',
          null,
          'After flashing, device says unable to mount data partition'
        ),
        React.createElement(
          'p',
          null,
          'This is expected after the filesystem is erased. Press confirm to finish resetting your device.'
        ),
        React.createElement('h3', null, 'General Tips'),
        React.createElement(
          'ul',
          null,
          React.createElement('li', null, 'Try another computer or OS'),
          React.createElement(
            'li',
            null,
            'Try different USB ports on your computer'
          ),
          React.createElement(
            'li',
            null,
            'Try different USB-C cables, including the OBD-C cable that came with the device'
          )
        ),
        React.createElement('h3', null, 'Other questions'),
        React.createElement(
          'p',
          null,
          'If you need help, join our ',
          React.createElement(
            'a',
            {
              href: 'https://discord.comma.ai',
              target: '_blank',
            },
            'Discord server'
          ),
          ' and go to the ',
          React.createElement('strong', null, '#hw-three-3x'),
          ' channel.'
        )
      ),
      React.createElement(
        'div',
        { className: 'hidden lg:block' },
        React.createElement('hr'),
        'flash.comma.ai version: ',
        React.createElement('code', null, version)
      )
    ),
    React.createElement(
      'div',
      {
        className:
          'lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800',
      },
      React.createElement(Flash, null)
    ),
    React.createElement(
      'div',
      {
        className:
          'w-screen max-w-none p-12 md:p-16 prose dark:prose-invert bg-white dark:bg-gray-900 lg:hidden',
      },
      'flash.comma.ai version: ',
      React.createElement('code', null, version.substring(0, 7))
    )
  );
}