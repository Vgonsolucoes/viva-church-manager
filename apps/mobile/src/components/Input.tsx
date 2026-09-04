import React, { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextProps,
} from "react-native";
import { theme } from "@/constants/theme";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  wrapperStyle?: StyleProp<ViewStyle>;
  labelProps?: TextProps;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, wrapperStyle, labelProps, style, placeholderTextColor, ...rest },
  ref,
) {
  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      {label ? (
        <Text style={[styles.label, labelProps?.style]} {...labelProps}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        {...rest}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholderTextColor={placeholderTextColor ?? theme.colors.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  label: {
    color: theme.colors.foregroundDark,
    fontSize: theme.font.sm,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontSize: theme.font.md,
    color: theme.colors.foregroundDark,
  },
  inputError: {
    borderColor: theme.colors.destructive,
    backgroundColor: theme.colors.destructiveSoft,
  },
  error: {
    marginTop: 6,
    color: theme.colors.destructive,
    fontSize: theme.font.sm,
    fontWeight: "500",
  },
});
