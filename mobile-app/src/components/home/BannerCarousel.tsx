import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Dimensions, StyleSheet, Image } from 'react-native';
import FastImage from 'react-native-fast-image';
import { spacing } from '../../theme/spacing';

const { width } = Dimensions.get('window');

interface BannerCarouselProps {
  images: string[];
  autoPlay?: boolean;
  interval?: number;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({
  images,
  autoPlay = true,
  interval = 3000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (autoPlay && images.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % images.length;
          scrollViewRef.current?.scrollTo({
            x: next * width,
            animated: true,
          });
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [autoPlay, images.length, interval]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {images.map((image, index) => (
          <FastImage
            key={index}
            source={{ uri: image }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width,
    height: 200,
  },
  pagination: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
});

export default BannerCarousel;


