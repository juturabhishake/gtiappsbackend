"use client";
import { useState } from 'react';
import Image from 'next/image';
import { Tab } from '@headlessui/react';

export default function Home() {
  const [selectedTab, setSelectedTab] = useState('parts');
  const parts = [1, 3, 5, 7];
  const machines = [2, 4, 6];

  const qrCodePath = selectedTab === 'parts' ? '/parts/qrcode' : '/machines/qrcode';

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-500 to-blue-500 p-8 font-sans flex flex-col justify-center items-center text-white">
      <h1 className="text-4xl font-bold mb-12">{selectedTab === 'parts' ? 'Part' : 'Machine'} QR Codes</h1>

      <Tab.Group selectedIndex={selectedTab === 'parts' ? 0 : 1} onChange={(index) => setSelectedTab(index === 0 ? 'parts' : 'machines')}>
        <Tab.List className="flex mb-8">
          <Tab className="px-6 py-3 text-xl font-medium cursor-pointer focus:outline-none bg-white text-black rounded-tl-lg transition duration-300 hover:bg-gray-300">Parts</Tab>
          <Tab className="px-6 py-3 text-xl font-medium cursor-pointer focus:outline-none bg-white text-black rounded-tr-lg transition duration-300 hover:bg-gray-300">Machines</Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <div className="grid grid-cols-2 gap-6">
              {parts.map((num) => (
                <div key={num} className="flex justify-center items-center bg-white p-8 rounded-lg shadow-lg">
                  <Image src={`${qrCodePath}${num}.png`} alt={`QR Code ${num}`} width={150} height={150} />
                  <p className="mt-4">Part #{num}</p>
                </div>
              ))}
            </div>
          </Tab.Panel>
          <Tab.Panel>
            <div className="grid grid-cols-2 gap-6">
              {machines.map((num) => (
                <div key={num} className="flex justify-center items-center bg-white p-8 rounded-lg shadow-lg">
                  <Image src={`${qrCodePath}${num}.png`} alt={`QR Code ${num}`} width={150} height={150} />
                  <p className="mt-4">Machine #{num}</p>
                </div>
              ))}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

    </div>
  );
}
