import React, { Fragment, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  ChevronDownIcon,
  DeviceTabletIcon
} from '@heroicons/react/24/outline';
import { eventService } from '@/services/api';
import type { Event } from '@/types';

interface NavigationProps {
  currentUser?: string;
  onLogout?: () => void;
  showUserMenu?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({
  currentUser,
  onLogout,
  showUserMenu = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);

  // Load active events for tablet voting
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const activeEvents = await eventService.getActive();
        setEvents(activeEvents);
      } catch (error) {
        console.error('Error loading events for navigation:', error);
      }
    };
    loadEvents();
  }, []);

  const navigation = [
    { 
      name: 'Home', 
      href: '/', 
      icon: HomeIcon, 
      current: location.pathname === '/' 
    },
    { 
      name: 'Manage', 
      href: '/manage', 
      icon: ClipboardDocumentListIcon, 
      current: location.pathname === '/manage' || location.pathname.startsWith('/manage')
    },
  ];

  const classNames = (...classes: string[]) => {
    return classes.filter(Boolean).join(' ');
  };

  return (
    <Disclosure as="nav" className="bg-gradient-to-r from-red-700 to-green-700 shadow-lg">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                    <span className="text-3xl">🎄</span>
                    <div className="hidden sm:block">
                      <span className="text-white font-bold text-xl block">
                        Instant Vote
                      </span>
                    </div>
                  </Link>
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    {navigation.map((item) => {
                      const Icon = item.icon;
                      const isCurrentPage = item.href === '/' 
                        ? location.pathname === '/' 
                        : location.pathname.startsWith(item.href);
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={classNames(
                            isCurrentPage
                              ? 'bg-red-800 text-white'
                              : 'text-red-100 hover:bg-red-600 hover:text-white',
                            'group flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200'
                          )}
                          aria-current={isCurrentPage ? 'page' : undefined}
                        >
                          <Icon
                            className={classNames(
                              isCurrentPage ? 'text-white' : 'text-red-200 group-hover:text-white',
                              'mr-2 h-4 w-4 transition-colors duration-200'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      );
                    })}

                    {/* Tablet Voting Dropdown */}
                    {/* {events.length > 0 && (
                      <Menu as="div" className="relative">
                        <Menu.Button className="group flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-100 hover:bg-red-600 hover:text-white transition-colors duration-200">
                          <DeviceTabletIcon className="mr-2 h-4 w-4 text-red-200 group-hover:text-white transition-colors duration-200" />
                          Voting
                          <ChevronDownIcon className="ml-1 h-4 w-4 text-red-200 group-hover:text-white" />
                        </Menu.Button>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100 bg-gray-50">
                              <strong>📱 Voting</strong>
                            </div>
                            {events.map((event) => (
                              <Menu.Item key={event.id}>
                                {({ active }) => (
                                  <button
                                    onClick={() => navigate(`/vote/event/${event.id}`)}
                                    className={classNames(
                                      active ? 'bg-gray-100' : '',
                                      'block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                                    )}
                                  >
                                    <div className="font-medium">{event.event_name}</div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(event.event_date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </div>
                                  </button>
                                )}
                              </Menu.Item>
                            ))}
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    )} */}
                  </div>
                </div>
              </div>

              <div className="hidden md:block">
                <div className="ml-4 flex items-center md:ml-6">
                  {currentUser && showUserMenu ? (
                    <Menu as="div" className="relative ml-3">
                      <div>
                        <Menu.Button className="relative flex max-w-xs items-center rounded-full bg-red-800 p-2 text-sm text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-800 transition-colors duration-200">
                          <span className="absolute -inset-1.5" />
                          <span className="sr-only">Open user menu</span>
                          <UserCircleIcon className="h-6 w-6" aria-hidden="true" />
                          <span className="ml-2 hidden sm:block">{currentUser}</span>
                          <ChevronDownIcon className="ml-1 h-4 w-4" aria-hidden="true" />
                        </Menu.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          <Menu.Item>
                            {({ active }) => (
                              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                                Logged in as: <strong>{currentUser}</strong>
                              </div>
                            )}
                          </Menu.Item>
                          {onLogout && (
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={onLogout}
                                  className={classNames(
                                    active ? 'bg-gray-100' : '',
                                    'block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                                  )}
                                >
                                  Sign out
                                </button>
                              )}
                            </Menu.Item>
                          )}
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  ) : currentUser ? (
                    <div className="flex items-center text-white bg-red-800 px-3 py-2 rounded-md">
                      <UserCircleIcon className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">{currentUser}</span>
                      {onLogout && (
                        <button
                          onClick={onLogout}
                          className="ml-3 text-xs text-red-200 hover:text-white underline"
                        >
                          logout
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="-mr-2 flex md:hidden">
                <Disclosure.Button className="relative inline-flex items-center justify-center rounded-md bg-red-800 p-2 text-red-100 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-800">
                  <span className="absolute -inset-0.5" />
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isCurrentPage = item.href === '/' 
                  ? location.pathname === '/' 
                  : location.pathname.startsWith(item.href);
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      isCurrentPage
                        ? 'bg-red-800 text-white'
                        : 'text-red-100 hover:bg-red-600 hover:text-white',
                      'group flex items-center px-3 py-2 rounded-md text-base font-medium'
                    )}
                    aria-current={isCurrentPage ? 'page' : undefined}
                  >
                    <Icon
                      className={classNames(
                        isCurrentPage ? 'text-white' : 'text-red-200 group-hover:text-white',
                        'mr-3 h-5 w-5'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}

              {/* Tablet Voting Mobile Menu */}
              {events.length > 0 && (
                <div className="border-t border-red-600 pt-3 mt-3">
                  <div className="px-3 py-2 text-sm font-medium text-red-200">
                    📱 Tablet Voting
                  </div>
                  {events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/vote/event/${event.id}`)}
                      className="group flex items-start px-3 py-2 rounded-md text-base font-medium text-red-100 hover:bg-red-600 hover:text-white w-full text-left"
                    >
                      <DeviceTabletIcon className="mr-3 h-5 w-5 text-red-200 group-hover:text-white mt-1" />
                      <div>
                        <div className="font-medium">{event.event_name}</div>
                        <div className="text-xs text-red-300 group-hover:text-red-100">
                          {new Date(event.event_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {currentUser && (
              <div className="border-t border-red-600 pb-3 pt-4">
                <div className="flex items-center px-5">
                  <UserCircleIcon className="h-8 w-8 text-red-200" />
                  <div className="ml-3">
                    <div className="text-base font-medium text-white">{currentUser}</div>
                    <div className="text-sm font-medium text-red-200">Logged in</div>
                  </div>
                </div>
                {onLogout && (
                  <div className="mt-3 space-y-1 px-2">
                    <button
                      onClick={onLogout}
                      className="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-red-100 hover:bg-red-600 hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
};

export default Navigation;
