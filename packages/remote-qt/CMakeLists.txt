cmake_minimum_required(VERSION 3.21)

project(slopcode_remote_qt VERSION 0.1.0 LANGUAGES CXX)

option(SLOPCODE_REMOTE_QT_BUILD_TESTS "Build deterministic RemoteV1 parser tests" ON)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Network WebSockets)

add_library(slopcode_remote_qt STATIC
  include/slopcode/remoteqt/frame.h
  include/slopcode/remoteqt/local_forwarder.h
  include/slopcode/remoteqt/session.h
  include/slopcode/remoteqt/ssh_supervisor.h
  src/frame.cpp
  src/local_forwarder.cpp
  src/session.cpp
  src/ssh_supervisor.cpp
)

target_include_directories(slopcode_remote_qt
  PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
)

target_link_libraries(slopcode_remote_qt
  PUBLIC
    Qt6::Core
    Qt6::Network
    Qt6::WebSockets
)

add_executable(slopcode-remote-qt-reference src/main.cpp)
target_link_libraries(slopcode-remote-qt-reference PRIVATE slopcode_remote_qt Qt6::Core)

if(SLOPCODE_REMOTE_QT_BUILD_TESTS)
  enable_testing()
  find_package(Qt6 6.5 REQUIRED COMPONENTS Test)

  add_executable(slopcode_remote_qt_parser_test tests/frame_test.cpp)
  target_link_libraries(slopcode_remote_qt_parser_test PRIVATE slopcode_remote_qt Qt6::Test)
  add_test(NAME slopcode_remote_qt_parser COMMAND slopcode_remote_qt_parser_test)
endif()
