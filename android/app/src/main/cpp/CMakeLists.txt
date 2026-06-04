cmake_minimum_required(VERSION 3.18.1)
project("native-lib")

# Path to nodejs-mobile prebuilt libnode.so (downloaded separately, see SETUP.md)
# Expected structure:  ../../../libs/jniLibs/<abi>/libnode.so
set(NODEJS_MOBILE_LIB_DIR "${CMAKE_SOURCE_DIR}/../../../libs/jniLibs/${ANDROID_ABI}")

# Import the prebuilt libnode.so as a shared library target.
add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION
    "${NODEJS_MOBILE_LIB_DIR}/libnode.so")

# Our JNI bridge — calls node::Start() from libnode.so
add_library(native-lib SHARED native-lib.cpp)

# Align LOAD segments to 16 KB (required for Android 15+ since Nov 2025)
# libnode.so is prebuilt and can't be fixed here — warning will persist
set_target_properties(native-lib PROPERTIES
    LINK_FLAGS "-Wl,-z,max-page-size=16384")

target_link_libraries(native-lib
    node       # libnode.so (provides node::Start)
    android
    log)
